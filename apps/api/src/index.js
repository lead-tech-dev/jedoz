import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';
import Stripe from 'stripe';
import { createPaymentsQueue } from './queue.js';
import { Server as SocketIOServer } from 'socket.io';
import { rateLimitAdsCreate, rateLimitLogin, rateLimitPaymentsInit, rateLimitRegister } from './security/rateLimit.js';
import { captchaGuard } from './security/captcha.js';
import pino from 'pino';

import crypto from 'crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
const app = express();
app.use(cors());
app.use((req, res, next) => {
  const header = req.headers['x-request-id'];
  const reqId = Array.isArray(header) ? header[0] : header;
  const requestId = (reqId && typeof reqId === 'string' && reqId.trim()) ? reqId.trim() : uuid();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});
// IMPORTANT: Stripe webhooks need the raw body.
// We skip JSON parsing for that route and attach it explicitly on the webhook handler.
app.use((req, res, next) => {
  if (req.originalUrl === '/payments/webhook/stripe') return next();
  return express.json({ limit: '10mb' })(req, res, next);
});

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const CREDIT_VALUE_XAF = parseInt(process.env.CREDIT_VALUE_XAF || '100', 10); // fallback: 1 credit = 100 XAF
const RESET_TOKEN_TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM = process.env.SENDGRID_FROM || '';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'JEDOZ';
const APP_MOBILE_SCHEME = process.env.APP_MOBILE_SCHEME || '';
const ADMIN_KPI_INTERVAL_MS = parseInt(process.env.ADMIN_KPI_INTERVAL_MS || '15000', 10);
const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_BACKUP_ENABLED = process.env.DB_BACKUP_ENABLED === 'true';
const DB_BACKUP_DIR = process.env.DB_BACKUP_DIR || path.join(process.cwd(), 'backups');
const DB_BACKUP_TIME = process.env.DB_BACKUP_TIME || '02:00';
const DB_BACKUP_RETENTION_DAYS = parseInt(process.env.DB_BACKUP_RETENTION_DAYS || '7', 10);
const PG_DUMP_PATH = process.env.PG_DUMP_PATH || 'pg_dump';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const APP_VERSION = process.env.APP_VERSION || '';
const ALERTS_SLACK_WEBHOOK_URL = process.env.ALERTS_SLACK_WEBHOOK_URL || '';
const ALERTS_EMAIL_TO = process.env.ALERTS_EMAIL_TO || '';
const ALERTS_THROTTLE_MS = parseInt(process.env.ALERTS_THROTTLE_MS || '60000', 10);
const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === 'true';
const ANALYTICS_SAMPLE_RATE = Math.min(Math.max(parseFloat(process.env.ANALYTICS_SAMPLE_RATE || '1'), 0), 1);
const ANALYTICS_MAX_META_BYTES = parseInt(process.env.ANALYTICS_MAX_META_BYTES || '8000', 10);
const ANALYTICS_MAX_RANGE_DAYS = parseInt(process.env.ANALYTICS_MAX_RANGE_DAYS || '90', 10);
const ANALYTICS_ACTIVE_WINDOW_MIN = parseInt(process.env.ANALYTICS_ACTIVE_WINDOW_MIN || '15', 10);
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;
const PRO_DISCOUNT_RATE = Math.min(Math.max(parseFloat(process.env.PRO_DISCOUNT_RATE || '0.3'), 0), 1);
const FORBIDDEN_WORDS = String(process.env.FORBIDDEN_WORDS || '')
  .split(',')
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);
const OCR_ENABLED = process.env.OCR_ENABLED === 'true';
const OCR_LANGS = String(process.env.OCR_LANGS || 'eng+fra').replace(/\s+/g, '');
const OCR_LANG_PATH = process.env.OCR_LANG_PATH || '';
const OCR_MAX_IMAGES = parseInt(process.env.OCR_MAX_IMAGES || '4', 10);
const OCR_TIMEOUT_MS = parseInt(process.env.OCR_TIMEOUT_MS || '12000', 10);
const OCR_IMAGE_MAX_MB = parseInt(process.env.OCR_IMAGE_MAX_MB || '6', 10);
const OCR_ALLOWED_MIME = String(process.env.OCR_ALLOWED_MIME || 'image/jpeg,image/png,image/webp')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const OCR_BLOCK_ON_ERROR = process.env.OCR_BLOCK_ON_ERROR === 'true';
const OCR_DEBUG = process.env.OCR_DEBUG === 'true';

const logger = pino({ level: LOG_LEVEL });
const APP_STARTED_AT = new Date();

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    const durationMs = Date.now() - started;
    const payload = {
      requestId: req.requestId || null,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
    };
    if (res.statusCode >= 500) logger.error(payload, 'http_error');
    else logger.warn(payload, 'http_warn');
  });
  next();
});


// --------------------
// AWS S3 (Step 4.6)
// --------------------
const AWS_REGION = process.env.AWS_REGION || '';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';
const AWS_S3_PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL || '';
const s3 = (AWS_REGION && AWS_S3_BUCKET) ? new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
}) : null;

const paymentsQueue = createPaymentsQueue();

// MTN MoMo (Collection) — configured later (Step 4.1)
const MTN_MOMO_BASE_URL = process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const MTN_MOMO_TARGET_ENV = process.env.MTN_MOMO_TARGET_ENV || 'sandbox';
const MTN_MOMO_SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY || '';
const MTN_MOMO_API_USER = process.env.MTN_MOMO_API_USER || '';
const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY || '';
const MTN_MOMO_CALLBACK_URL = process.env.MTN_MOMO_CALLBACK_URL || '';
const MTN_MOMO_CURRENCY = process.env.MTN_MOMO_CURRENCY || '';
const MTN_MOMO_COLLECTION_BASE = `${MTN_MOMO_BASE_URL.replace(/\/$/, '')}/collection/v1_0`;
const MTN_MOMO_TOKEN_URL = `${MTN_MOMO_BASE_URL.replace(/\/$/, '')}/collection/token/`;

// Public base URL used to build callback URLs (must be HTTPS for real providers)
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || '';

// Orange Money — two common integration styles:
// 1) Orange Developer Web Payment (OM WebPay) for merchants (redirect + notifUrl)
// 2) Operator / integrator "Merchant Payment" endpoints (payToken/status)
// We implement a flexible adapter that can work with (2) or (1) depending on ORANGE_MODE.
const ORANGE_BASE_URL = process.env.ORANGE_BASE_URL || 'https://api.orange.com';
const ORANGE_AUTH_HEADER = process.env.ORANGE_AUTH_HEADER || ''; // e.g. "Basic ..." or "Bearer ..." depending on your Orange contract
const ORANGE_USERNAME = process.env.ORANGE_USERNAME || '';
const ORANGE_PASSWORD = process.env.ORANGE_PASSWORD || '';
const ORANGE_AUTH_TOKEN = process.env.ORANGE_AUTH_TOKEN || ''; // optional pre-issued token
const ORANGE_MERCHANT_KEY = process.env.ORANGE_MERCHANT_KEY || '';
const ORANGE_NOTIF_URL = process.env.ORANGE_NOTIF_URL || (PUBLIC_API_URL ? `${PUBLIC_API_URL}/payments/webhook/orange` : '');
const ORANGE_MODE = (process.env.ORANGE_MODE || 'MERCHANT').toUpperCase();
const ORANGE_TOKEN_URL = process.env.ORANGE_TOKEN_URL || '';
const ORANGE_INIT_URL = process.env.ORANGE_INIT_URL || '';
const ORANGE_STATUS_URL = process.env.ORANGE_STATUS_URL || '';
const ORANGE_PAY_URL = process.env.ORANGE_PAY_URL || '';
const ORANGE_COUNTRY = process.env.ORANGE_COUNTRY || '';

// Tiny in-memory cache for Orange access tokens
let __orangeTokenCache = { token: null, exp: 0 };
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// --------------------
// Uploads (local MVP)
// --------------------
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 10) || '';
      const base = path.basename(file.originalname || 'photo', ext).slice(0, 40);
      const safeBase = base.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'photo';
      const userId = req.user?.id ? String(req.user.id).slice(0, 8) : 'anon';
      const stamp = Date.now();
      cb(null, `photo_${userId}_${stamp}_${safeBase}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// --------------------
// Helpers
// --------------------
function normalizeCameroonPhone(input) {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00237')) digits = digits.slice(5);
  else if (digits.startsWith('237')) digits = digits.slice(3);
  if (digits.length !== 9) return null;
  if (!digits.startsWith('6')) return null;
  return `237${digits}`;
}

function stripDiacritics(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value) {
  const lower = stripDiacritics(String(value || '').toLowerCase());
  return lower.replace(/[^a-z0-9]+/g, '');
}

function findForbiddenWords(input) {
  if (!FORBIDDEN_WORDS.length) return [];
  const text = normalizeText(input);
  if (!text) return [];
  return FORBIDDEN_WORDS.filter((word) => text.includes(normalizeText(word)));
}

function assertNoForbiddenWords(value, field) {
  const hits = findForbiddenWords(value);
  if (!hits.length) return;
  const err = new Error('FORBIDDEN_WORDS');
  err.code = 'FORBIDDEN_WORDS';
  err.details = { field, words: hits.slice(0, 5) };
  throw err;
}

const OCR_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff']);
let ocrWorkerPromise = null;

function isOcrImageCandidate(item) {
  if (!item) return false;
  const mime = item.mime ? String(item.mime).toLowerCase() : '';
  if (mime) {
    if (OCR_ALLOWED_MIME.length && !OCR_ALLOWED_MIME.includes(mime)) return false;
    return mime.startsWith('image/');
  }
  const url = typeof item === 'string' ? item : item.url;
  if (!url) return false;
  const cleanUrl = String(url).split('?')[0];
  const ext = path.extname(cleanUrl).toLowerCase();
  return OCR_IMAGE_EXTENSIONS.has(ext);
}

function resolveUploadPath(url) {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return path.join(UPLOAD_DIR, url.replace('/uploads/', ''));
  if (url.startsWith('uploads/')) return path.join(UPLOAD_DIR, url.replace(/^uploads\//, ''));
  return null;
}

function withTimeout(promise, ms) {
  if (!ms) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function fetchImageBuffer(url) {
  if (!url) return null;
  const maxBytes = OCR_IMAGE_MAX_MB * 1024 * 1024;
  const localPath = resolveUploadPath(String(url));
  if (localPath) {
    const stat = await fs.promises.stat(localPath);
    if (stat.size > maxBytes) return null;
    return fs.promises.readFile(localPath);
  }
  if (!/^https?:\/\//i.test(String(url))) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  if (!response.ok) throw new Error(`OCR_FETCH_FAILED:${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length > maxBytes) return null;
  return buffer;
}

async function getOcrWorker() {
  if (!OCR_ENABLED) return null;
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const tesseract = await import('tesseract.js');
      const createWorker = tesseract.createWorker || tesseract.default?.createWorker;
      if (!createWorker) throw new Error('OCR_WORKER_UNAVAILABLE');
      const worker = await createWorker({
        langPath: OCR_LANG_PATH ? path.resolve(OCR_LANG_PATH) : undefined,
        logger: OCR_DEBUG ? (m) => console.log('[ocr]', m) : undefined,
      });
      await worker.loadLanguage(OCR_LANGS);
      await worker.initialize(OCR_LANGS);
      return worker;
    })().catch((err) => {
      ocrWorkerPromise = null;
      throw err;
    });
  }
  return ocrWorkerPromise;
}

async function runOcrOnBuffer(buffer) {
  const worker = await getOcrWorker();
  if (!worker || !buffer) return '';
  const result = await worker.recognize(buffer);
  return String(result?.data?.text || '');
}

async function scanMediaForForbiddenWords({ items = [], source, userId }) {
  if (!OCR_ENABLED || !FORBIDDEN_WORDS.length) return [];
  const list = Array.isArray(items) ? items : [];
  const candidates = list
    .map((item) => (typeof item === 'string' ? { url: item } : item))
    .filter((item) => item && isOcrImageCandidate(item));
  if (!candidates.length) return [];
  const limit = Math.max(1, OCR_MAX_IMAGES || 1);
  const hits = new Set();
  for (const item of candidates.slice(0, limit)) {
    const url = item.url || item.originalUrl || '';
    try {
      const buffer = await withTimeout(fetchImageBuffer(url), OCR_TIMEOUT_MS);
      if (!buffer) continue;
      const text = await withTimeout(runOcrOnBuffer(buffer), OCR_TIMEOUT_MS);
      if (!text) continue;
      const words = findForbiddenWords(text);
      words.forEach((word) => hits.add(word));
      if (hits.size) break;
    } catch (err) {
      if (OCR_BLOCK_ON_ERROR) {
        const error = new Error('OCR_FAILED');
        error.code = 'OCR_FAILED';
        error.details = { source, url };
        throw error;
      }
      console.warn('OCR scan failed', { source, userId, url, error: err?.message || err });
    }
  }
  return Array.from(hits);
}

const FORBIDDEN_BAN_STRIKES = parseInt(process.env.FORBIDDEN_BAN_STRIKES || '2', 10);

async function recordForbiddenStrike(userId, meta = {}) {
  const now = new Date();
  const security = await prisma.userSecurity.upsert({
    where: { userId },
    update: {
      forbiddenStrikeCount: { increment: 1 },
      lastForbiddenAt: now,
      flaggedAt: now,
      flagReason: 'FORBIDDEN_WORDS',
    },
    create: {
      userId,
      forbiddenStrikeCount: 1,
      lastForbiddenAt: now,
      flaggedAt: now,
      flagReason: 'FORBIDDEN_WORDS',
    },
  });
  const strikes = security.forbiddenStrikeCount || 0;
  if (security.isBanned) {
    return { strikes, banned: true };
  }
  if (strikes >= FORBIDDEN_BAN_STRIKES && !security.isBanned) {
    await prisma.userSecurity.update({
      where: { userId },
      data: { isBanned: true, bannedAt: now, banReason: 'FORBIDDEN_WORDS' },
    });
    await prisma.adminAuditLog.create({
      data: { actorId: null, action: 'security.user.ban', entityType: 'User', entityId: userId, meta: { reason: 'FORBIDDEN_WORDS', ...meta } },
    }).catch(() => {});
    return { strikes, banned: true };
  }
  await prisma.adminAuditLog.create({
    data: { actorId: null, action: 'security.user.flag', entityType: 'User', entityId: userId, meta: { reason: 'FORBIDDEN_WORDS', strikes, ...meta } },
  }).catch(() => {});
  return { strikes, banned: false };
}

let lastAlertAt = 0;

function shouldSendAlert() {
  if (!ALERTS_THROTTLE_MS) return true;
  const now = Date.now();
  if (now - lastAlertAt < ALERTS_THROTTLE_MS) return false;
  lastAlertAt = now;
  return true;
}

async function sendAlertEmail({ subject, text }) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM || !ALERTS_EMAIL_TO) return false;
  const recipients = ALERTS_EMAIL_TO.split(',').map((email) => email.trim()).filter(Boolean);
  if (!recipients.length) return false;
  const payload = {
    personalizations: [{ to: recipients.map((email) => ({ email })) }],
    from: { email: SENDGRID_FROM, name: SENDGRID_FROM_NAME },
    subject,
    content: [{ type: 'text/plain', value: text }],
  };
  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      logger.error({ status: resp.status, body }, 'alerts_email_failed');
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, 'alerts_email_exception');
    return false;
  }
}

async function sendSlackAlert(text) {
  if (!ALERTS_SLACK_WEBHOOK_URL) return false;
  try {
    const resp = await fetch(ALERTS_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      logger.error({ status: resp.status, body }, 'alerts_slack_failed');
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, 'alerts_slack_exception');
    return false;
  }
}

async function notifyAlert({ title, message, meta }) {
  if (!ALERTS_SLACK_WEBHOOK_URL && !ALERTS_EMAIL_TO) return;
  if (!shouldSendAlert()) return;
  const metaText = meta ? `\n\nmeta: ${JSON.stringify(meta)}` : '';
  const text = `ALERT: ${title}\n${message || 'Unknown error'}${metaText}`;
  await Promise.all([
    sendSlackAlert(text),
    sendAlertEmail({ subject: `ALERT: ${title}`, text }),
  ]);
}

function sanitizeAnalyticsMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  try {
    const json = JSON.stringify(meta);
    if (json.length > ANALYTICS_MAX_META_BYTES) {
      return { truncated: true };
    }
    return meta;
  } catch {
    return null;
  }
}

async function recordAnalyticsEvent({ name, source, userId, anonymousId, meta, ip, userAgent }) {
  if (!ANALYTICS_ENABLED) return null;
  if (ANALYTICS_SAMPLE_RATE < 1 && Math.random() > ANALYTICS_SAMPLE_RATE) return null;
  const safeName = String(name || '').trim().slice(0, 80);
  if (!safeName) return null;
  const safeSource = source ? String(source).trim().slice(0, 40) : null;
  const safeAnonymousId = anonymousId ? String(anonymousId).trim().slice(0, 120) : null;
  const safeMeta = sanitizeAnalyticsMeta(meta);
  const safeIp = ip ? String(ip).slice(0, 80) : null;
  const safeUserAgent = userAgent ? String(userAgent).slice(0, 200) : null;
  try {
    return await prisma.analyticsEvent.create({
      data: {
        name: safeName,
        source: safeSource,
        userId: userId || null,
        anonymousId: safeAnonymousId,
        ip: safeIp,
        userAgent: safeUserAgent,
        meta: safeMeta || undefined,
      },
    });
  } catch (err) {
    logger.warn({ err, name: safeName }, 'analytics_failed');
    return null;
  }
}

function cleanupOldBackups() {
  if (!DB_BACKUP_RETENTION_DAYS || DB_BACKUP_RETENTION_DAYS <= 0) return;
  const cutoff = Date.now() - DB_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  try {
    const files = fs.readdirSync(DB_BACKUP_DIR);
    files.forEach((file) => {
      const fullPath = path.join(DB_BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
      }
    });
  } catch {}
}

function scheduleDbBackups() {
  if (!DB_BACKUP_ENABLED) return;
  if (!DATABASE_URL) {
    console.warn('DB_BACKUP_ENABLED but DATABASE_URL is missing.');
    return;
  }
  fs.mkdirSync(DB_BACKUP_DIR, { recursive: true });

  const parseTime = (value) => {
    const parts = String(value || '').split(':');
    const hour = Number(parts[0] || 0);
    const minute = Number(parts[1] || 0);
    return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
  };

  const nextRunDelay = () => {
    const { hour, minute } = parseTime(DB_BACKUP_TIME);
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  };

  const runBackup = () => new Promise((resolve) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${stamp}.dump`;
    const filePath = path.join(DB_BACKUP_DIR, filename);
    const args = ['--dbname', DATABASE_URL, '--format', 'c', '--file', filePath];
    const child = spawn(PG_DUMP_PATH, args, { stdio: 'inherit' });
    child.on('error', (err) => {
      console.error('DB backup failed to start.', err);
      resolve();
    });
    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`DB backup failed (code ${code}).`);
      } else {
        cleanupOldBackups();
      }
      resolve();
    });
  });

  const scheduleNext = () => {
    const delay = nextRunDelay();
    setTimeout(() => {
      runBackup().finally(scheduleNext);
    }, delay);
  };

  scheduleNext();
}

function parseMtnStatus(payload) {
  const raw = [
    payload?.status,
    payload?.reason,
    payload?.transactionStatus,
    payload?.result?.status,
    payload?.result?.reason,
  ]
    .filter(Boolean)
    .map((v) => String(v))
    .join(' ')
    .toUpperCase();
  const reason =
    payload?.reason ||
    payload?.transactionStatus ||
    payload?.status ||
    payload?.result?.reason ||
    payload?.result?.status ||
    null;
  const insufficientFunds = /INSUFFICIENT|NOT_ENOUGH|LOW_BALANCE|PAYER_NOT_ENOUGH/.test(raw);
  const isSuccess = raw.includes('SUCCESS') || raw.includes('COMPLETED') || raw.includes('APPROVED');
  const isFail = raw.includes('FAIL') || raw.includes('REJECT') || raw.includes('CANCEL') || raw.includes('DECLINED');
  return { rawStatus: raw, reason, insufficientFunds, isSuccess, isFail };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildResetUrl(token) {
  const base = APP_URL.endsWith('/') ? APP_URL.slice(0, -1) : APP_URL;
  return `${base}/auth/reset-password/${token}`;
}

function buildMobileResetUrl(token) {
  if (!APP_MOBILE_SCHEME) return null;
  const scheme = APP_MOBILE_SCHEME.replace(/:\/+$/, '');
  return `${scheme}://auth/reset-password/${token}`;
}

async function sendResetEmail({ to, resetUrl, token, lang = 'fr' }) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM) return false;
  const isFr = String(lang).toLowerCase().startsWith('fr');
  const mobileUrl = buildMobileResetUrl(token);
  const subject = isFr ? 'Réinitialisation du mot de passe' : 'Reset your password';
  const text = isFr
    ? `Bonjour,\n\nCliquez sur ce lien pour réinitialiser votre mot de passe :\n${resetUrl}\n\nOu utilisez ce code : ${token}${mobileUrl ? `\n\nLien mobile :\n${mobileUrl}` : ''}\n\nCe lien expire bientôt.`
    : `Hi,\n\nClick this link to reset your password:\n${resetUrl}\n\nOr use this code: ${token}${mobileUrl ? `\n\nMobile link:\n${mobileUrl}` : ''}\n\nThis link will expire soon.`;
  const html = isFr
    ? `<p>Bonjour,</p><p>Cliquez sur ce lien pour réinitialiser votre mot de passe :</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Ou utilisez ce code : <strong>${token}</strong></p>${mobileUrl ? `<p>Lien mobile : <a href="${mobileUrl}">${mobileUrl}</a></p>` : ''}<p>Ce lien expire bientôt.</p>`
    : `<p>Hi,</p><p>Click this link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Or use this code: <strong>${token}</strong></p>${mobileUrl ? `<p>Mobile link: <a href="${mobileUrl}">${mobileUrl}</a></p>` : ''}<p>This link will expire soon.</p>`;

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: SENDGRID_FROM, name: SENDGRID_FROM_NAME },
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html },
    ],
  };

  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('SendGrid error', resp.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('SendGrid exception', err);
    return false;
  }
}

function ensureMtnConfigured() {
  if (!MTN_MOMO_SUBSCRIPTION_KEY || !MTN_MOMO_API_USER || !MTN_MOMO_API_KEY) {
    throw Object.assign(new Error('MTN_NOT_CONFIGURED'), { code: 'MTN_NOT_CONFIGURED' });
  }
}

async function mtnGetAccessToken() {
  ensureMtnConfigured();
  const auth = Buffer.from(`${MTN_MOMO_API_USER}:${MTN_MOMO_API_KEY}`).toString('base64');
  const r = await fetch(MTN_MOMO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Ocp-Apim-Subscription-Key': MTN_MOMO_SUBSCRIPTION_KEY,
    },
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) {
    throw Object.assign(new Error('MTN_TOKEN_FAILED'), { code: 'MTN_TOKEN_FAILED', details: json || text });
  }
  const token = json?.access_token || json?.accessToken || json?.token;
  if (!token) {
    throw Object.assign(new Error('MTN_TOKEN_MISSING'), { code: 'MTN_TOKEN_MISSING', details: json || text });
  }
  return token;
}

async function mtnRequestToPay({ amount, currency, phone, referenceId, externalId, payerMessage, payeeNote, callbackUrl }) {
  const token = await mtnGetAccessToken();
  const payload = {
    amount: String(amount),
    currency: (currency || 'XAF').toUpperCase(),
    externalId: String(externalId || referenceId),
    payer: { partyIdType: 'MSISDN', partyId: String(phone || '') },
    payerMessage: payerMessage || 'Payment',
    payeeNote: payeeNote || 'Payment',
  };
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Reference-Id': referenceId,
    'X-Target-Environment': MTN_MOMO_TARGET_ENV,
    'Ocp-Apim-Subscription-Key': MTN_MOMO_SUBSCRIPTION_KEY,
    'Content-Type': 'application/json',
  };
  if (callbackUrl) headers['X-Callback-Url'] = callbackUrl;
  const r = await fetch(`${MTN_MOMO_COLLECTION_BASE}/requesttopay`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) {
    throw Object.assign(new Error('MTN_INIT_FAILED'), { code: 'MTN_INIT_FAILED', details: json || text });
  }
  return json || {};
}

async function mtnGetPaymentStatus(referenceId) {
  const token = await mtnGetAccessToken();
  const r = await fetch(`${MTN_MOMO_COLLECTION_BASE}/requesttopay/${encodeURIComponent(referenceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': MTN_MOMO_TARGET_ENV,
      'Ocp-Apim-Subscription-Key': MTN_MOMO_SUBSCRIPTION_KEY,
    },
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) {
    throw Object.assign(new Error('MTN_STATUS_FAILED'), { code: 'MTN_STATUS_FAILED', details: json || text });
  }
  return json || {};
}

async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (user.role === 'user') {
      const security = await prisma.userSecurity.findUnique({ where: { userId: user.id } });
      if (security?.isBanned) {
        return res.status(403).json({ error: 'BANNED', reason: security.banReason || null, bannedAt: security.bannedAt || null });
      }
    }
    req.user = user;


// Step 4.8: link device (light)
try {
  const h = (process.env.SECURITY_DEVICE_HEADER || 'x-device-id').toLowerCase();
  const deviceId = req.headers[h];
  if (deviceId && typeof deviceId === 'string' && deviceId.length >= 8 && deviceId.length <= 128) {
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const ua = req.headers['user-agent'] || null;
    await prisma.userDevice.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId } },
      update: { ipLast: String(ip || ''), userAgent: ua ? String(ua) : null },
      create: { userId: user.id, deviceId, ipFirst: ip ? String(ip) : null, ipLast: ip ? String(ip) : null, userAgent: ua ? String(ua) : null },
    });
  }
} catch {}

    req.jwt = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
}

async function getOptionalUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

async function ensureWalletForUser(userId){
  const existing = await prisma.creditWallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.creditWallet.create({ data: { userId, balance: 0 } });
}

async function getActiveSubscription(userId) {
  const now = new Date();
  return prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', endAt: { gt: now } },
    orderBy: { endAt: 'desc' },
  });
}

async function resolveProStatus(user) {
  if (!user) return false;
  if (user.role && user.role !== 'user') return true;
  const active = await getActiveSubscription(user.id);
  return Boolean(active);
}

function applyProDiscount(cost, isPro) {
  if (!isPro || cost <= 0) return cost;
  const discounted = Math.round(cost * (1 - PRO_DISCOUNT_RATE));
  return Math.max(0, discounted);
}

async function getPricing({ action, country, categorySlug }) {
  // Most specific (country+category) wins, then country, then global.
  const whereBase = { action, isActive: true };
  const candidates = await prisma.pricingRule.findMany({
    where: {
      ...whereBase,
      OR: [
        { country: country || null, categorySlug: categorySlug || null },
        { country: country || null, categorySlug: null },
        { country: null, categorySlug: categorySlug || null },
        { country: null, categorySlug: null },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 1,
  });
  return candidates[0] || null;
}

async function getQuota({ action, country, categorySlug, role }) {
  const candidates = await prisma.quotaRule.findMany({
    where: {
      action,
      isActive: true,
      OR: [
        { role: role || null, country: country || null, categorySlug: categorySlug || null },
        { role: role || null, country: country || null, categorySlug: null },
        { role: role || null, country: null, categorySlug: null },
        { role: null, country: country || null, categorySlug: null },
        { role: null, country: null, categorySlug: null },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 1,
  });
  return candidates[0] || null;
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}


function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'FORBIDDEN' });
  return next();
}

function staffOnly(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  return next();
}

async function logAdminAction(req, { action, entityType, entityId, meta }) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: req.user?.id || null,
        action: String(action || 'unknown'),
        entityType: entityType ? String(entityType) : null,
        entityId: entityId ? String(entityId) : null,
        ip: req.headers['x-forwarded-for']?.toString() || req.ip || null,
        meta: meta || null,
      },
    });
  } catch (_e) {
    // Best-effort audit logging.
  }
}

async function hasAdminPermission(userId, key) {
  if (!userId) return false;
  const found = await prisma.adminUserRole.findFirst({
    where: {
      userId,
      role: {
        permissions: {
          some: {
            permission: { key: String(key) },
          },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(found);
}

function requireAdminPermission(permissionKey) {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    const ok = await hasAdminPermission(req.user?.id, permissionKey);
    if (!ok) return res.status(403).json({ error: 'FORBIDDEN' });
    return next();
  };
}

const ADMIN_SOCKET_ROOM = 'admin:dashboard';

async function computeAdminKpis() {
  const today = startOfTodayISO();
  const [
    adsTotal,
    adsPending,
    adsReported,
    usersTotal,
    alertsOpen,
    ticketsOpen,
    ticketsPending,
    paymentsFailed,
    paymentsPending,
    paymentsRefunded,
    paymentsToday,
  ] = await Promise.all([
    prisma.ad.count(),
    prisma.ad.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.report.count(),
    prisma.user.count(),
    prisma.adminAlert.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'PENDING' } }),
    prisma.paymentIntent.count({ where: { status: 'FAILED' } }),
    prisma.paymentIntent.count({ where: { status: 'PENDING' } }),
    prisma.paymentIntent.count({ where: { status: 'REFUNDED' } }),
    prisma.paymentIntent.aggregate({
      where: { status: 'SUCCESS', createdAt: { gte: today } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return {
    ads: { total: adsTotal, pending: adsPending, reported: adsReported },
    users: { total: usersTotal },
    alerts: { open: alertsOpen },
    tickets: { open: ticketsOpen, pending: ticketsPending },
    payments: {
      pending: paymentsPending,
      failed: paymentsFailed,
      refunded: paymentsRefunded,
      todayCount: paymentsToday._count._all || 0,
      todayAmount: paymentsToday._sum.amount || 0,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function emitAdminKpis(target = ADMIN_SOCKET_ROOM) {
  const kpis = await computeAdminKpis();
  io.to(target).emit('admin:kpi', kpis);
  return kpis;
}

async function createAdminAlert({
  type,
  severity,
  title,
  message,
  userId,
  paymentIntentId,
  adId,
  meta,
}) {
  const alert = await prisma.adminAlert.create({
    data: {
      type,
      severity: severity || null,
      title,
      message: message || null,
      userId: userId || null,
      paymentIntentId: paymentIntentId || null,
      adId: adId || null,
      meta: meta || null,
    },
  });
  io.to(ADMIN_SOCKET_ROOM).emit('admin:alert:new', alert);
  void emitAdminKpis().catch(() => {});
  return alert;
}

async function alertForPaymentStatus(intentId, status, extraMeta) {
  if (!intentId) return;
  if (status !== 'FAILED' && status !== 'REFUNDED') return;
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: intentId },
    select: { id: true, userId: true, provider: true, productType: true, amount: true, currency: true, status: true },
  });
  if (!intent) return;
  const isChargeback = status === 'REFUNDED';
  const existing = await prisma.adminAlert.findFirst({
    where: {
      paymentIntentId: intent.id,
      type: isChargeback ? 'CHARGEBACK' : 'PAYMENT',
      status: { in: ['OPEN', 'ACK'] },
    },
    select: { id: true },
  });
  if (existing) return;
  await createAdminAlert({
    type: isChargeback ? 'CHARGEBACK' : 'PAYMENT',
    severity: isChargeback ? 'high' : 'medium',
    title: isChargeback ? 'Chargeback' : 'Paiement échoué',
    message: `${intent.provider} · ${intent.productType} · ${intent.amount} ${intent.currency}`,
    userId: intent.userId,
    paymentIntentId: intent.id,
    meta: { status, ...extraMeta },
  }).catch(() => {});
}

async function ensureAdminRbacSeed() {
  const defaultPermissions = [
    'admin.dashboard.view',
    'admin.alerts.manage',
    'admin.support.manage',
    'admin.audit.view',
    'admin.rbac.manage',
  ];

  for (const key of defaultPermissions) {
    await prisma.adminPermission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  const adminRole = await prisma.adminRole.upsert({
    where: { name: 'admin' },
    update: { isSystem: true },
    create: { name: 'admin', description: 'Accès complet', isSystem: true },
  });

  const perms = await prisma.adminPermission.findMany({ where: { key: { in: defaultPermissions } } });
  const rolePermData = perms.map((perm) => ({ roleId: adminRole.id, permissionId: perm.id }));
  if (rolePermData.length) {
    await prisma.adminRolePermission.createMany({ data: rolePermData, skipDuplicates: true });
  }

  const adminUsers = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  if (adminUsers.length) {
    await prisma.adminUserRole.createMany({
      data: adminUsers.map((u) => ({ userId: u.id, roleId: adminRole.id })),
      skipDuplicates: true,
    });
  }
}

// --------------------
// Chat helpers
// --------------------
const CHAT_RATE_LIMIT = parseInt(process.env.CHAT_RATE_LIMIT || '8', 10);
const CHAT_RATE_WINDOW_MS = parseInt(process.env.CHAT_RATE_WINDOW_MS || '30000', 10);
const CHAT_MAX_BODY = parseInt(process.env.CHAT_MAX_BODY || '2000', 10);
const CHAT_MAX_ATTACHMENTS = parseInt(process.env.CHAT_MAX_ATTACHMENTS || '4', 10);
const CHAT_MAX_LINKS = parseInt(process.env.CHAT_MAX_LINKS || '1', 10);
const CHAT_RATE_LIMIT_PRO = parseInt(process.env.CHAT_RATE_LIMIT_PRO || '20', 10);
const CHAT_RATE_WINDOW_MS_PRO = parseInt(process.env.CHAT_RATE_WINDOW_MS_PRO || String(CHAT_RATE_WINDOW_MS), 10);
const CHAT_MAX_BODY_PRO = parseInt(process.env.CHAT_MAX_BODY_PRO || '5000', 10);
const CHAT_MAX_ATTACHMENTS_PRO = parseInt(process.env.CHAT_MAX_ATTACHMENTS_PRO || '8', 10);
const CHAT_MAX_LINKS_PRO = parseInt(process.env.CHAT_MAX_LINKS_PRO || '3', 10);
const CHAT_BLOCK_LINKS = process.env.CHAT_BLOCK_LINKS === 'true';
const CHAT_FLAG_WORDS = (process.env.CHAT_FLAG_WORDS || 'whatsapp,telegram,snapchat,cashapp,onlyfans').split(',').map((s) => s.trim()).filter(Boolean);
const CHAT_SPAM_SCORE_THRESHOLD = parseInt(process.env.CHAT_SPAM_SCORE_THRESHOLD || '6', 10);
const CHAT_SPAM_LINK_SCORE = parseInt(process.env.CHAT_SPAM_LINK_SCORE || '2', 10);
const CHAT_SPAM_KEYWORD_SCORE = parseInt(process.env.CHAT_SPAM_KEYWORD_SCORE || '1', 10);
const CHAT_SPAM_LENGTH_SCORE = parseInt(process.env.CHAT_SPAM_LENGTH_SCORE || '2', 10);
const CHAT_MESSAGE_TYPES = new Set(['text', 'sticker', 'voice', 'call', 'system']);
const chatRate = new Map();

const CHAT_LIMITS_STANDARD = {
  rateLimit: CHAT_RATE_LIMIT,
  windowMs: CHAT_RATE_WINDOW_MS,
  maxBody: CHAT_MAX_BODY,
  maxAttachments: CHAT_MAX_ATTACHMENTS,
  maxLinks: CHAT_MAX_LINKS,
};

const CHAT_LIMITS_PRO = {
  rateLimit: CHAT_RATE_LIMIT_PRO,
  windowMs: CHAT_RATE_WINDOW_MS_PRO,
  maxBody: CHAT_MAX_BODY_PRO,
  maxAttachments: CHAT_MAX_ATTACHMENTS_PRO,
  maxLinks: CHAT_MAX_LINKS_PRO,
};

function isChatRateLimited(userId, limit, windowMs) {
  const now = Date.now();
  const entry = chatRate.get(userId) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  chatRate.set(userId, entry);
  return entry.count > limit;
}

async function getChatLimitsForUser(user) {
  const isPro = await resolveProStatus(user);
  return isPro ? CHAT_LIMITS_PRO : CHAT_LIMITS_STANDARD;
}

function extractLinks(text) {
  if (!text) return [];
  const matches = text.match(/(https?:\/\/|www\.)\S+/gi);
  return matches || [];
}

function detectChatFlags(text) {
  const flags = {};
  const links = extractLinks(text);
  if (links.length) flags.links = links;
  const lower = String(text || '').toLowerCase();
  const matchedWords = CHAT_FLAG_WORDS.filter((w) => w && lower.includes(w));
  if (matchedWords.length) flags.keywords = matchedWords;
  return flags;
}

function scoreChatMessage({ text, flags, attachments, type }) {
  let score = 0;
  const linkCount = (flags.links || []).length;
  const keywordCount = (flags.keywords || []).length;
  if (linkCount) score += CHAT_SPAM_LINK_SCORE + Math.max(0, linkCount - 1);
  if (keywordCount) score += CHAT_SPAM_KEYWORD_SCORE * keywordCount;
  if (text && text.length > 600) score += CHAT_SPAM_LENGTH_SCORE;
  if (!text && (attachments || []).length > 0) score += 1;
  if (type && type !== 'text') score += 1;
  return score;
}

function buildChatWarning({ flags, spamScore }) {
  const warnings = [];
  if ((flags.links || []).length) warnings.push('CONTAINS_LINKS');
  if ((flags.keywords || []).length) warnings.push('SENSITIVE_KEYWORDS');
  if (spamScore >= CHAT_SPAM_SCORE_THRESHOLD) warnings.push('SPAM_SUSPECT');
  return warnings.length ? warnings.join(',') : null;
}

function chatErrorStatus(code) {
  if (code === 'RATE_LIMITED') return 429;
  if (code === 'BLOCKED_BY_USER' || code === 'LINK_BLOCKED') return 403;
  if (code === 'NOT_MEMBER') return 403;
  if (code === 'EMPTY_MESSAGE' || code === 'MESSAGE_TOO_LONG' || code === 'TOO_MANY_LINKS' || code === 'TOO_MANY_ATTACHMENTS' || code === 'INVALID_TYPE') return 400;
  return 400;
}

async function getSocketUser(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

async function getConversationOrThrow(conversationId, userId) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: { include: { members: true } } },
  });
  if (!member) throw Object.assign(new Error('NOT_MEMBER'), { code: 'NOT_MEMBER' });
  if (!member.conversation?.adId) {
    throw Object.assign(new Error('AD_REQUIRED'), { code: 'AD_REQUIRED' });
  }
  return member;
}

async function isBlockedByMember(conversationId, senderId) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { not: senderId } },
    select: { userId: true },
  });
  const memberIds = members.map((m) => m.userId);
  if (!memberIds.length) return false;
  const block = await prisma.userBlock.findFirst({
    where: { blockerId: { in: memberIds }, blockedId: senderId },
  });
  return Boolean(block);
}

async function createChatMessage({ conversationId, sender, body, attachments, type, meta }) {
  const senderId = sender?.id;
  if (!senderId) {
    throw Object.assign(new Error('INVALID_SENDER'), { code: 'INVALID_SENDER' });
  }
  const rawType = String(type || 'text');
  if (type && !CHAT_MESSAGE_TYPES.has(rawType)) {
    throw Object.assign(new Error('INVALID_TYPE'), { code: 'INVALID_TYPE' });
  }
  const safeType = CHAT_MESSAGE_TYPES.has(rawType) ? rawType : 'text';
  const limits = await getChatLimitsForUser(sender);
  const text = String(body || '').trim();
  const forbiddenHits = text ? findForbiddenWords(text) : [];
  if (forbiddenHits.length) {
    if (sender?.role === 'user') {
      await recordForbiddenStrike(senderId, { source: 'chat.message', words: forbiddenHits, conversationId });
    }
    throw Object.assign(new Error('FORBIDDEN_WORDS'), { code: 'FORBIDDEN_WORDS', details: { words: forbiddenHits } });
  }
  const safeAttachments = (attachments || []).filter((a) => a && typeof a.url === 'string');
  const ocrHits = await scanMediaForForbiddenWords({ items: safeAttachments, source: 'chat.message', userId: senderId });
  if (ocrHits.length) {
    if (sender?.role === 'user') {
      await recordForbiddenStrike(senderId, { source: 'chat.message.ocr', words: ocrHits, conversationId });
    }
    throw Object.assign(new Error('FORBIDDEN_WORDS'), { code: 'FORBIDDEN_WORDS', details: { words: ocrHits } });
  }
  const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : null;
  if (!text && safeAttachments.length === 0 && !safeMeta) {
    throw Object.assign(new Error('EMPTY_MESSAGE'), { code: 'EMPTY_MESSAGE' });
  }
  if (text.length > limits.maxBody) {
    throw Object.assign(new Error('MESSAGE_TOO_LONG'), { code: 'MESSAGE_TOO_LONG' });
  }
  if (safeAttachments.length > limits.maxAttachments) {
    throw Object.assign(new Error('TOO_MANY_ATTACHMENTS'), { code: 'TOO_MANY_ATTACHMENTS' });
  }
  if (isChatRateLimited(senderId, limits.rateLimit, limits.windowMs)) {
    throw Object.assign(new Error('RATE_LIMITED'), { code: 'RATE_LIMITED' });
  }
  const blocked = await isBlockedByMember(conversationId, senderId);
  if (blocked) {
    throw Object.assign(new Error('BLOCKED_BY_USER'), { code: 'BLOCKED_BY_USER' });
  }

  const flags = detectChatFlags(text);
  const linkCount = (flags.links || []).length;
  if (CHAT_BLOCK_LINKS && linkCount > 0) {
    throw Object.assign(new Error('LINK_BLOCKED'), { code: 'LINK_BLOCKED' });
  }
  if (linkCount > limits.maxLinks) {
    throw Object.assign(new Error('TOO_MANY_LINKS'), { code: 'TOO_MANY_LINKS' });
  }

  const spamScore = scoreChatMessage({ text, flags, attachments: safeAttachments, type: safeType });
  const warning = buildChatWarning({ flags, spamScore });

  const now = new Date();
  const out = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderId,
        body: text || '',
        type: safeType,
        flagged: Object.keys(flags).length > 0 || spamScore >= CHAT_SPAM_SCORE_THRESHOLD,
        status: Object.keys(flags).length > 0 || spamScore >= CHAT_SPAM_SCORE_THRESHOLD ? 'FLAGGED' : 'SENT',
        flags: Object.keys(flags).length ? flags : undefined,
        warning: warning || undefined,
        spamScore,
        meta: safeMeta || undefined,
        attachments: {
          create: safeAttachments.map((a) => {
            const size = Number(a.size);
            return ({
            url: a.url,
            mime: a.mime || null,
            size: Number.isFinite(size) ? size : null,
            type: a.type || null,
            });
          }),
        },
      },
      include: {
        attachments: true,
        sender: { select: { id: true, username: true } },
        reactions: { select: { emoji: true, userId: true } },
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });
    await tx.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: senderId } },
      data: { lastReadAt: now },
    });
    await tx.messageRead.upsert({
      where: { messageId_userId: { messageId: message.id, userId: senderId } },
      update: { readAt: now },
      create: { messageId: message.id, userId: senderId, readAt: now },
    });
    return message;
  });

  return out;
}

async function markConversationRead({ conversationId, userId, messageId }) {
  const now = new Date();
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: now },
  });
  if (messageId) {
    await prisma.messageRead.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { readAt: now },
      create: { messageId, userId, readAt: now },
    });
  }
  return now;
}

function roomForConversation(conversationId) {
  return `conv:${conversationId}`;
}

io.use(async (socket, next) => {
  const authHeader = socket.handshake.headers.authorization || '';
  const token =
    socket.handshake.auth?.token ||
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    socket.handshake.query?.token;
  const user = await getSocketUser(token);
  if (!user) return next(new Error('UNAUTHENTICATED'));
  socket.data.user = user;
  return next();
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  socket.join(`user:${user.id}`);
  if (user.role === 'admin') {
    socket.join(ADMIN_SOCKET_ROOM);
    void emitAdminKpis(socket.id).catch(() => {});
  }

  socket.on('conversation:join', async (payload, ack) => {
    try {
      const conversationId = String(payload?.conversationId || '');
      if (!conversationId) throw new Error('INVALID_INPUT');
      await getConversationOrThrow(conversationId, user.id);
      socket.join(roomForConversation(conversationId));
      if (ack) ack({ ok: true });
    } catch (e) {
      if (ack) ack({ ok: false, error: e.code || e.message || 'ERROR' });
    }
  });

  socket.on('conversation:leave', (payload, ack) => {
    const conversationId = String(payload?.conversationId || '');
    if (conversationId) socket.leave(roomForConversation(conversationId));
    if (ack) ack({ ok: true });
  });

  socket.on('typing:start', async (payload) => {
    const conversationId = String(payload?.conversationId || '');
    if (!conversationId) return;
    socket.to(roomForConversation(conversationId)).emit('typing', { conversationId, userId: user.id, isTyping: true });
  });

  socket.on('typing:stop', async (payload) => {
    const conversationId = String(payload?.conversationId || '');
    if (!conversationId) return;
    socket.to(roomForConversation(conversationId)).emit('typing', { conversationId, userId: user.id, isTyping: false });
  });

  socket.on('message:send', async (payload, ack) => {
    try {
      const conversationId = String(payload?.conversationId || '');
      if (!conversationId) throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
      await getConversationOrThrow(conversationId, user.id);
      const message = await createChatMessage({
        conversationId,
        sender: user,
        body: payload?.body || '',
        attachments: payload?.attachments || [],
        type: payload?.type || 'text',
        meta: payload?.meta || null,
      });
      io.to(roomForConversation(conversationId)).emit('message:new', message);
      if (ack) ack({ ok: true, message });
    } catch (e) {
      if (ack) ack({ ok: false, error: e.code || e.message || 'ERROR' });
    }
  });

  socket.on('message:read', async (payload, ack) => {
    try {
      const conversationId = String(payload?.conversationId || '');
      const messageId = payload?.messageId ? String(payload.messageId) : null;
      if (!conversationId) throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
      await getConversationOrThrow(conversationId, user.id);
      const readAt = await markConversationRead({ conversationId, userId: user.id, messageId });
      io.to(roomForConversation(conversationId)).emit('message:read', { conversationId, userId: user.id, messageId, readAt });
      if (ack) ack({ ok: true, readAt });
    } catch (e) {
      if (ack) ack({ ok: false, error: e.code || e.message || 'ERROR' });
    }
  });
});

function computeActiveBoostBadges(boosts) {
  const now = Date.now();
  const active = (boosts || []).filter((b) => new Date(b.startAt).getTime() <= now && now < new Date(b.endAt).getTime());
  const types = Array.from(new Set(active.map((b) => String(b.type))));
  return { active, types };
}

function boostScoreFromTypes(types) {
  // Higher = more priority in listings.
  const set = new Set(types);
  let score = 0;
  if (set.has('HOME')) score += 400;
  if (set.has('TOP')) score += 300;
  if (set.has('VIP')) score += 200;
  if (set.has('URGENT')) score += 100;
  return score;
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function extractPrice(dynamic) {
  if (!dynamic || typeof dynamic !== 'object') return null;
  const candidates = ['price', 'prix', 'tarif', 'amount', 'cost', 'rate'];
  for (const key of candidates) {
    if (dynamic[key] !== undefined && dynamic[key] !== null) {
      const parsed = parseNumber(dynamic[key]);
      if (parsed !== null) return Math.round(parsed);
    }
  }
  return null;
}

function normalizeTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((t) => String(t).trim()).filter(Boolean)));
  }
  if (typeof input === 'string') {
    return Array.from(new Set(input.split(',').map((t) => t.trim()).filter(Boolean)));
  }
  return [];
}

function extractTags(dynamic) {
  if (!dynamic || typeof dynamic !== 'object') return [];
  if (dynamic.tags) return normalizeTags(dynamic.tags);
  if (dynamic.tag) return normalizeTags(dynamic.tag);
  return [];
}

function extractLatLng(dynamic) {
  if (!dynamic || typeof dynamic !== 'object') return { lat: null, lng: null };
  if (dynamic.location && typeof dynamic.location === 'object') {
    const lat = parseNumber(dynamic.location.lat);
    const lng = parseNumber(dynamic.location.lng);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  const lat = parseNumber(dynamic.lat ?? dynamic.latitude);
  const lng = parseNumber(dynamic.lng ?? dynamic.longitude);
  if (lat !== null && lng !== null) return { lat, lng };
  return { lat: null, lng: null };
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const rLat1 = toRad(aLat);
  const rLat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function publicAdView(ad) {
  const { active, types } = computeActiveBoostBadges(ad.boosts);
  return {
    id: ad.id,
    userId: ad.userId,
    status: ad.status,
    title: ad.title,
    description: ad.description,
    city: ad.city,
    country: ad.country,
    categorySlug: ad.categorySlug,
    price: ad.price ?? null,
    tags: ad.tags || [],
    lat: ad.lat ?? null,
    lng: ad.lng ?? null,
    badges: Array.from(new Set([...(ad.badges || []), ...types])),
    activeBoosts: active.map((b) => ({ id: b.id, type: b.type, startAt: b.startAt, endAt: b.endAt })),
    dynamic: ad.dynamic || {},
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
    views: ad.views,
    media: (ad.media || []).map((m) => ({ id: m.id, type: m.type, url: m.url, mime: m.mime, size: m.size })),
    moderation: ad.moderation || null,
  };
}

// --------------------
// Health
// --------------------
/**
 * ============================
 * PAYMENTS (REAL) — Step 4
 * Providers: MTN / ORANGE / STRIPE (+ MOCK for local dev)
 * ============================
 */

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// --------------------
// Orange Money helpers (Merchant Payment style)
// Endpoints referenced by community SDKs include:
//  - POST {baseURL}/token
//  - POST {baseURL}/omcoreapis/1.0.2/mp/init
//  - GET  {baseURL}/omcoreapis/1.0.2/mp/paymentstatus/{payToken}
//  - GET  {baseURL}/omcoreapis/1.0.1/mp/pay
// Your local Orange operator / integrator may expose a different base URL or auth scheme.
// --------------------
function orangeBuildAuthHeader() {
  if (ORANGE_AUTH_HEADER) return ORANGE_AUTH_HEADER;
  if (ORANGE_USERNAME && ORANGE_PASSWORD) {
    const b64 = Buffer.from(`${ORANGE_USERNAME}:${ORANGE_PASSWORD}`).toString('base64');
    return `Basic ${b64}`;
  }
  return '';
}

async function orangeGetAccessToken() {
  if (ORANGE_AUTH_TOKEN) return ORANGE_AUTH_TOKEN;
  const now = Date.now();
  if (__orangeTokenCache.token && now < __orangeTokenCache.exp - 30_000) return __orangeTokenCache.token;

  const auth = orangeBuildAuthHeader();
  if (!auth) throw Object.assign(new Error('ORANGE_NOT_CONFIGURED'), { code: 'ORANGE_NOT_CONFIGURED' });

  const base = ORANGE_BASE_URL.replace(/\/$/, '');
  const tokenUrl = ORANGE_TOKEN_URL || (ORANGE_MODE === 'WEBPAY' ? `${base}/oauth/v3/token` : `${base}/token`);
  const r = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // Some Orange setups expect OAuth2 client credentials grant.
    body: 'grant_type=client_credentials',
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok || !json?.access_token) {
    throw Object.assign(new Error('ORANGE_TOKEN_FAILED'), { code: 'ORANGE_TOKEN_FAILED', details: json || text });
  }
  const expiresIn = Number(json.expires_in || 3600);
  __orangeTokenCache = { token: json.access_token, exp: Date.now() + expiresIn * 1000 };
  return json.access_token;
}

function replaceOrangeTemplate(template, values) {
  if (!template) return '';
  return template
    .replace('{payToken}', values.payToken || '')
    .replace('{orderId}', values.orderId || '')
    .replace('{ref}', values.ref || '')
    .replace('{country}', values.country || '');
}

async function orangeInitPayment({ amount, currency, orderId, returnUrl, cancelUrl, notifUrl, description, country }) {
  const token = await orangeGetAccessToken();
  const base = ORANGE_BASE_URL.replace(/\/$/, '');
  const resolvedCountry = (ORANGE_COUNTRY || country || 'CM').toLowerCase();
  const initUrl = ORANGE_INIT_URL || (ORANGE_MODE === 'WEBPAY'
    ? `${base}/orange-money-webpay/${resolvedCountry}/v1/webpayment`
    : `${base}/omcoreapis/1.0.2/mp/init`);

  const payload = {
    merchant_key: ORANGE_MERCHANT_KEY || undefined,
    order_id: orderId,
    amount: String(amount),
    currency: (currency || 'XAF'),
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notif_url: notifUrl,
    lang: 'fr',
    reference: orderId,
    description: description || 'Payment',
  };

  const r = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) {
    throw Object.assign(new Error('ORANGE_INIT_FAILED'), { code: 'ORANGE_INIT_FAILED', details: json || text });
  }

  const payToken = json?.payToken || json?.pay_token || json?.token || json?.notif_token || null;
  if (!payToken) {
    throw Object.assign(new Error('ORANGE_INIT_NO_TOKEN'), { code: 'ORANGE_INIT_NO_TOKEN', details: json || text });
  }

  const payUrlTemplate = ORANGE_PAY_URL || (ORANGE_MODE === 'WEBPAY' ? '' : `${base}/omcoreapis/1.0.1/mp/pay?payToken={payToken}`);
  const rawPaymentUrl = json?.payment_url || json?.paymentUrl || json?.paymentURL || null;
  const paymentUrl = rawPaymentUrl || (payUrlTemplate ? replaceOrangeTemplate(payUrlTemplate, { payToken, orderId, ref: payToken, country: resolvedCountry }) : null);
  return { payToken, paymentUrl, raw: json };
}

async function orangeGetPaymentStatus({ payToken, orderId, country }) {
  const token = await orangeGetAccessToken();
  const base = ORANGE_BASE_URL.replace(/\/$/, '');
  const resolvedCountry = (ORANGE_COUNTRY || country || 'CM').toLowerCase();
  const statusTemplate = ORANGE_STATUS_URL || (ORANGE_MODE === 'WEBPAY' ? '' : `${base}/omcoreapis/1.0.2/mp/paymentstatus/{payToken}`);
  if (!statusTemplate) {
    throw Object.assign(new Error('ORANGE_STATUS_UNSUPPORTED'), { code: 'ORANGE_STATUS_UNSUPPORTED' });
  }
  const ref = payToken || orderId || '';
  const statusUrl = replaceOrangeTemplate(statusTemplate, { payToken, orderId, ref, country: resolvedCountry });
  const r = await fetch(statusUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!r.ok) {
    throw Object.assign(new Error('ORANGE_STATUS_FAILED'), { code: 'ORANGE_STATUS_FAILED', details: json || text });
  }
  return json || {};
}

async function resolveProductAndAmount({ productType, productRefId, country }) {
  if (productType === 'CREDIT_PACK') {
    const pack = await prisma.creditPack.findUnique({ where: { id: productRefId } });
    if (!pack || pack.isActive === false) throw Object.assign(new Error('PACK_NOT_FOUND'), { code: 'PACK_NOT_FOUND' });
    // amount is in currency units (XAF for CM)
    return { amount: pack.price, currency: pack.currency, meta: { credits: pack.credits, packName: pack.name } };
  }

  if (productType === 'PRO_SUBSCRIPTION') {
    const offer = await prisma.proOffer.findUnique({ where: { id: productRefId } });
    if (!offer || offer.isActive === false) throw Object.assign(new Error('OFFER_NOT_FOUND'), { code: 'OFFER_NOT_FOUND' });
    // fallback money price: creditsCost * CREDIT_VALUE_XAF (configurable)
    const amount = offer.creditsCost * CREDIT_VALUE_XAF;
    return { amount, currency: offer.currency, meta: { plan: offer.plan, durationDays: offer.durationDays, offerName: offer.name } };
  }

  if (productType === 'BOOST') {
    // productRefId = adId. Additional parameters live in providerData at init time
    // fallback: amount is computed from PricingRule if present (creditsCost * CREDIT_VALUE_XAF)
    const amount = 20 * CREDIT_VALUE_XAF;
    return { amount, currency: 'XAF', meta: {} };
  }

  throw Object.assign(new Error('INVALID_PRODUCT'), { code: 'INVALID_PRODUCT' });
}

async function fulfillPaymentIntent(intentId) {
  // Idempotent fulfillment: only if not already SUCCESS-fulfilled
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) throw new Error('INTENT_NOT_FOUND');
  if (intent.status !== 'SUCCESS') return;

  // Already fulfilled? We mark fulfillment by providerData.fulfilledAt
  if (intent.providerData && intent.providerData.fulfilledAt) return;

  const now = new Date();

  if (intent.productType === 'CREDIT_PACK') {
    const pack = await prisma.creditPack.findUnique({ where: { id: intent.productRefId } });
    if (!pack) throw new Error('PACK_NOT_FOUND');
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.creditWallet.upsert({
        where: { userId: intent.userId },
        update: { balance: { increment: pack.credits } },
        create: { userId: intent.userId, balance: pack.credits },
      });

      await tx.creditTransaction.create({
        data: {
          amount: pack.credits,
          type: 'CREDIT',
          reason: 'PACK_PURCHASE',
          meta: { packId: pack.id, packName: pack.name, credits: pack.credits },
          user: { connect: { id: intent.userId } },
          wallet: { connect: { id: wallet.id } },
        },
      });

      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { providerData: { ...(intent.providerData || {}), fulfilledAt: now.toISOString(), walletBalanceAfter: wallet.balance } },
      });
    });
    void recordAnalyticsEvent({
      name: 'payment.success',
      source: 'api',
      userId: intent.userId,
      meta: {
        productType: intent.productType,
        provider: intent.provider,
        packId: pack.id,
        packName: pack.name,
        amount: intent.amount,
        currency: intent.currency,
      },
    });
    return;
  }

  if (intent.productType === 'PRO_SUBSCRIPTION') {
    const offer = await prisma.proOffer.findUnique({ where: { id: intent.productRefId } });
    if (!offer) throw new Error('OFFER_NOT_FOUND');

    await prisma.$transaction(async (tx) => {
      const startAt = now;
      const endAt = new Date(now.getTime() + offer.durationDays * 24 * 60 * 60 * 1000);

      // expire existing active subscription
      await tx.subscription.updateMany({
        where: { userId: intent.userId, status: 'ACTIVE', endAt: { lte: now } },
        data: { status: 'EXPIRED' },
      });

      await tx.subscription.create({
        data: { userId: intent.userId, plan: offer.plan, startAt, endAt, status: 'ACTIVE' },
      });

      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { providerData: { ...(intent.providerData || {}), fulfilledAt: now.toISOString() } },
      });
    });
    void recordAnalyticsEvent({
      name: 'payment.success',
      source: 'api',
      userId: intent.userId,
      meta: {
        productType: intent.productType,
        provider: intent.provider,
        offerId: offer.id,
        plan: offer.plan,
        amount: intent.amount,
        currency: intent.currency,
      },
    });
    return;
  }

  if (intent.productType === 'BOOST') {
    // NOTE: Boost purchase is already handled via credits in Step 2.
    // For direct money boost payments, parse providerData for { adId, type, durationHours }.
    const { adId, type, durationHours } = (intent.providerData || {});
    if (!adId || !type || !durationHours) {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { providerData: { ...(intent.providerData || {}), fulfilledAt: now.toISOString(), note: 'BOOST missing payload' } },
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      const startAt = now;
      const endAt = new Date(now.getTime() + Number(durationHours) * 60 * 60 * 1000);
      await tx.adBoost.create({
        data: { adId, userId: intent.userId, type, startAt, endAt },
      });
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { providerData: { ...(intent.providerData || {}), fulfilledAt: now.toISOString() } },
      });
    });
    void recordAnalyticsEvent({
      name: 'payment.success',
      source: 'api',
      userId: intent.userId,
      meta: {
        productType: intent.productType,
        provider: intent.provider,
        adId,
        boostType: type,
        amount: intent.amount,
        currency: intent.currency,
      },
    });
  }
}

async function createPaymentEventOnce({ provider, eventId, intentId, payload }) {
  try {
    await prisma.paymentEvent.create({ data: { provider, eventId, intentId, payload } });
    return true;
  } catch (e) {
    // unique violation -> already handled
    return false;
  }
}

// Init payment (auth required)
app.post('/payments/init', authRequired, rateLimitPaymentsInit, async (req, res) => {
  const { provider, productType, productRefId, country = 'CM', phone, boostType, durationHours } = req.body || {};
  const rawIdempotency = req.headers['idempotency-key'] || req.body?.idempotencyKey || '';
  const idempotencyKey = String(rawIdempotency || '').trim() || null;

  if (!provider || !productType) return res.status(400).json({ error: 'INVALID_REQUEST' });
  const needsPhone = provider === 'MTN' || provider === 'ORANGE';
  const normalizedPhone = needsPhone ? normalizeCameroonPhone(phone) : null;
  if (needsPhone && !normalizedPhone) return res.status(400).json({ error: 'INVALID_PHONE' });

  try {
    const resolved = await resolveProductAndAmount({ productType, productRefId, country });
    let amount = resolved.amount;
    let currency = String(resolved.currency || '').toUpperCase();
    const meta = resolved.meta;

    if (provider === 'MTN') {
      if (MTN_MOMO_CURRENCY) {
        currency = MTN_MOMO_CURRENCY.toUpperCase();
      } else if (MTN_MOMO_TARGET_ENV === 'sandbox') {
        currency = 'EUR';
      } else if (country === 'CM') {
        currency = 'XAF';
      }
    }
    if (provider === 'ORANGE') {
      currency = country === 'CM' ? 'XAF' : (currency || 'XAF');
    }
    if (!currency) currency = 'XAF';

    if (idempotencyKey) {
      const existing = await prisma.paymentIntent.findFirst({
        where: {
          userId: req.user.id,
          provider,
          productType,
          productRefId: productRefId || null,
          providerData: { path: ['idempotencyKey'], equals: idempotencyKey },
        },
      });
      if (existing) {
        return res.json({
          intentId: existing.id,
          status: existing.status,
          checkoutUrl: existing.providerData?.checkoutUrl,
          redirectUrl: existing.providerData?.redirectUrl,
          paymentUrl: existing.providerData?.paymentUrl,
          reference: existing.providerRef,
          instructions: existing.providerData?.instructions,
          phone: existing.providerData?.phone || null,
        });
      }
    }

    const intent = await prisma.paymentIntent.create({
      data: {
        userId: req.user.id,
        provider,
        productType,
        productRefId,
        amount,
        currency,
        country,
        status: provider === 'MOCK' ? 'SUCCESS' : 'PENDING',
        providerData: {
          phone: normalizedPhone,
          idempotencyKey,
          meta,
          ...(productType === 'BOOST' ? { adId: productRefId, type: boostType || null, durationHours: durationHours || null } : {}),
        },
      },
    });

    // Provider-specific init
    if (provider === 'MOCK') {
      await paymentsQueue.add('process_intent', { intentId: intent.id }, { jobId: `intent:${intent.id}`, removeOnComplete: 200, removeOnFail: 200 });
      return res.json({ intentId: intent.id, status: 'SUCCESS', redirectUrl: `${APP_URL}/payment/success?intentId=${intent.id}` });
    }

    if (provider === 'STRIPE') {
      if (!stripe) return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED' });
      // NOTE: Stripe uses the smallest currency unit; if XAF is used, it's zero-decimal on Stripe (when supported).
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: (currency || 'xof').toLowerCase(),
              product_data: { name: meta?.packName || meta?.offerName || productType },
              unit_amount: amount,
            },
          },
        ],
        success_url: `${APP_URL}/payment/success?intentId=${intent.id}`,
        cancel_url: `${APP_URL}/payment/cancel?intentId=${intent.id}`,
        metadata: { intentId: intent.id },
      }, idempotencyKey ? { idempotencyKey } : undefined);

      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { providerRef: session.id, providerData: { ...(intent.providerData || {}), checkoutUrl: session.url } },
      });

      return res.json({ intentId: intent.id, status: 'PENDING', checkoutUrl: session.url });
    }

    if (provider === 'MTN') {
      const providerRef = uuid();
      const callbackUrl = MTN_MOMO_CALLBACK_URL || (PUBLIC_API_URL ? `${PUBLIC_API_URL}/payments/webhook/mtn` : '');
      await mtnRequestToPay({
        amount,
        currency,
        phone: normalizedPhone,
        referenceId: providerRef,
        externalId: intent.id,
        payerMessage: meta?.packName || meta?.offerName || productType,
        payeeNote: meta?.packName || meta?.offerName || productType,
        callbackUrl: callbackUrl || undefined,
      });
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          providerRef,
          providerData: {
            ...(intent.providerData || {}),
            momoRef: providerRef,
            instructions: 'Confirmez le paiement sur votre téléphone (MTN MoMo).',
          },
        },
      });
      return res.json({
        intentId: intent.id,
        status: 'PENDING',
        reference: providerRef,
        instructions: 'Confirmez le paiement sur votre téléphone (MTN MoMo).',
        phone: normalizedPhone,
      });
    }

    if (provider === 'ORANGE') {
      // Orange Money (merchant payment style): init returns a payToken and often a hosted payment page URL.
      // If ORANGE is not configured, we keep a clear error.
      const returnUrl = `${APP_URL}/payment/success?intentId=${intent.id}`;
      const cancelUrl = `${APP_URL}/payment/cancel?intentId=${intent.id}`;
      const notifUrl = ORANGE_NOTIF_URL || (PUBLIC_API_URL ? `${PUBLIC_API_URL}/payments/webhook/orange` : '');

      if (!notifUrl) return res.status(500).json({ error: 'ORANGE_NOT_CONFIGURED', details: 'Missing ORANGE_NOTIF_URL or PUBLIC_API_URL' });

      const { payToken, paymentUrl, raw } = await orangeInitPayment({
        amount,
        currency,
        orderId: intent.id,
        returnUrl,
        cancelUrl,
        notifUrl,
        country,
        description: meta?.packName || meta?.offerName || productType,
      });

      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          providerRef: payToken,
          providerData: {
            ...(intent.providerData || {}),
            orangePayToken: payToken,
            orangeOrderId: intent.id,
            orangeMode: ORANGE_MODE,
            paymentUrl,
            rawInit: raw,
          },
        },
      });

      // Front can redirect to paymentUrl (hosted payment page). If your Orange contract uses USSD push instead,
      // you can display instructions and poll status.
      return res.json({ intentId: intent.id, status: 'PENDING', paymentUrl, payToken, instructions: 'Suivez les instructions Orange Money pour valider le paiement.', phone: normalizedPhone });
    }

    return res.status(400).json({ error: 'UNKNOWN_PROVIDER' });
  } catch (e) {
    if (e.code === 'PACK_NOT_FOUND' || e.code === 'OFFER_NOT_FOUND') return res.status(404).json({ error: e.code });
    if (e.code) {
      return res.status(500).json({ error: e.code, details: e.details || null });
    }
    return res.status(500).json({ error: 'PAYMENT_INIT_FAILED' });
  }
});

// Payment status (polling)
app.get('/payments/:id/status', authRequired, async (req, res) => {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
  if (!intent || intent.userId !== req.user.id) return res.status(404).json({ error: 'NOT_FOUND' });
  if (intent.status === 'SUCCESS') {
    await fulfillPaymentIntent(intent.id);
    const refreshed = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
    return res.json({ id: refreshed.id, status: refreshed.status, provider: refreshed.provider, amount: refreshed.amount, currency: refreshed.currency });
  }

  // Provider polling fallback (helps when callbacks are not delivered)
  try {
    if (intent.status === 'PENDING' && intent.provider === 'ORANGE' && intent.providerRef) {
      const st = await orangeGetPaymentStatus({
        payToken: intent.providerRef,
        orderId: intent.providerData?.orangeOrderId || intent.id,
        country: intent.country || 'CM',
      });
      const rawStatus = (st.status || st.transactionStatus || st.confirmtxnstatus || '').toString().toUpperCase();
      // Normalize common values: SUCCESSFUL/SUCCESS/OK
      const isSuccess = rawStatus.includes('SUCCESS') || rawStatus.includes('OK');
      const isFail = rawStatus.includes('FAIL') || rawStatus.includes('CANCEL') || rawStatus.includes('REJECT');
      if (isSuccess) {
        await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCESS', providerData: { ...(intent.providerData || {}), orangeStatus: st } } });
        await fulfillPaymentIntent(intent.id);
        await paymentsQueue.add('process_intent', { intentId: intent.id }, { jobId: `intent:${intent.id}`, removeOnComplete: 200, removeOnFail: 200 });
        const refreshed = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        return res.json({ id: refreshed.id, status: refreshed.status, provider: refreshed.provider, amount: refreshed.amount, currency: refreshed.currency });
      }
      if (isFail) {
        await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED', providerData: { ...(intent.providerData || {}), orangeStatus: st } } });
        await alertForPaymentStatus(intent.id, 'FAILED', { source: 'orange.poll' });
        const refreshed = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        return res.json({ id: refreshed.id, status: refreshed.status, provider: refreshed.provider, amount: refreshed.amount, currency: refreshed.currency });
      }
    }
    if (intent.status === 'PENDING' && intent.provider === 'MTN' && intent.providerRef) {
      const st = await mtnGetPaymentStatus(intent.providerRef);
      const parsed = parseMtnStatus(st);
      if (parsed.isSuccess) {
        await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCESS', providerData: { ...(intent.providerData || {}), mtnStatus: st } } });
        await fulfillPaymentIntent(intent.id);
        await paymentsQueue.add('process_intent', { intentId: intent.id }, { jobId: `intent:${intent.id}`, removeOnComplete: 200, removeOnFail: 200 });
        const refreshed = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        return res.json({ id: refreshed.id, status: refreshed.status, provider: refreshed.provider, amount: refreshed.amount, currency: refreshed.currency, reason: parsed.reason, insufficientFunds: parsed.insufficientFunds });
      }
      if (parsed.isFail) {
        await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED', providerData: { ...(intent.providerData || {}), mtnStatus: st } } });
        await alertForPaymentStatus(intent.id, 'FAILED', { source: 'mtn.poll', reason: parsed.reason });
        const refreshed = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
        return res.json({ id: refreshed.id, status: refreshed.status, provider: refreshed.provider, amount: refreshed.amount, currency: refreshed.currency, reason: parsed.reason, insufficientFunds: parsed.insufficientFunds });
      }
      return res.json({ id: intent.id, status: intent.status, provider: intent.provider, amount: intent.amount, currency: intent.currency, reason: parsed.reason, insufficientFunds: parsed.insufficientFunds });
    }
  } catch (e) {
    // Ignore polling errors; client can retry.
  }

  return res.json({ id: intent.id, status: intent.status, provider: intent.provider, amount: intent.amount, currency: intent.currency });
});

// Stripe webhook (raw body required)
app.post('/payments/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(400).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error`);
  }

  const eventId = event.id;
  const obj = event.data?.object;

  // For checkout-based flows, Stripe puts our metadata on the Checkout Session.
  // For other event types (refunds / failures), we may need to resolve the PaymentIntent -> PaymentIntentIntent.
  const intentIdFromMetadata = obj?.metadata?.intentId || obj?.metadata?.intent_id || null;
  let intentId = intentIdFromMetadata;

  // Try to resolve intentId for refund/failure events via stored stripePaymentIntentId mapping.
  const stripePaymentIntentId = obj?.payment_intent || obj?.paymentIntent || obj?.data?.object?.payment_intent || null;
  if (!intentId && stripePaymentIntentId) {
    const mapped = await prisma.paymentIntent.findFirst({
      where: {
        provider: 'STRIPE',
        providerData: {
          path: ['stripePaymentIntentId'],
          equals: String(stripePaymentIntentId),
        },
      },
      select: { id: true },
    }).catch(() => null);
    if (mapped?.id) intentId = mapped.id;
  }

  if (!intentId) {
    // still store event for audit
    await prisma.paymentEvent.create({ data: { provider: 'STRIPE', eventId, intentId: 'unknown', payload: event } }).catch(()=>{});
    return res.json({ received: true });
  }

  const created = await createPaymentEventOnce({ provider: 'STRIPE', eventId, intentId, payload: event });
  if (!created) return res.json({ received: true });

  if (event.type === 'checkout.session.completed') {
    // Store stripe payment_intent id for refunds/reconciliation.
    const paymentIntentId = obj?.payment_intent || null;
    await prisma.paymentIntent.update({
      where: { id: intentId },
      data: {
        status: 'SUCCESS',
        providerData: {
          ...(await prisma.paymentIntent.findUnique({ where: { id: intentId }, select: { providerData: true } }).then(r => r?.providerData || {}).catch(()=>({}))),
          stripeSessionId: obj?.id || null,
          stripePaymentIntentId: paymentIntentId ? String(paymentIntentId) : null,
        },
      },
    });
    // Process fulfillment asynchronously via BullMQ worker
    await paymentsQueue.add('process_intent', { intentId }, { jobId: `intent:${intentId}`, removeOnComplete: 200, removeOnFail: 200 });
  } else if (event.type === 'checkout.session.expired') {
    await prisma.paymentIntent.update({ where: { id: intentId }, data: { status: 'CANCELLED' } }).catch(()=>{});
  } else if (event.type === 'payment_intent.payment_failed') {
    await prisma.paymentIntent.update({ where: { id: intentId }, data: { status: 'FAILED' } }).catch(()=>{});
    await alertForPaymentStatus(intentId, 'FAILED', { source: 'stripe.webhook' });
  } else if (event.type === 'charge.refunded') {
    // Mark refunded (full refund). Partial refunds can be added later.
    await prisma.paymentIntent.update({ where: { id: intentId }, data: { status: 'REFUNDED' } }).catch(()=>{});
    await alertForPaymentStatus(intentId, 'REFUNDED', { source: 'stripe.webhook' });
  }

  return res.json({ received: true });
});

// --------------------
// Admin: Payments (Step 4.3 + 4.4)
// --------------------
// List payment intents with filters + cursor pagination
app.get('/admin/payments/intents', authRequired, staffOnly, async (req, res) => {
  const { provider, status, productType, userId, q, cursor, limit = 25, from, to } = req.query || {};
  const take = Math.min(Math.max(parseInt(String(limit), 10) || 25, 1), 100);

  const where = {
    ...(provider ? { provider: String(provider) } : {}),
    ...(status ? { status: String(status) } : {}),
    ...(productType ? { productType: String(productType) } : {}),
    ...(userId ? { userId: String(userId) } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(String(from)) } : {}), ...(to ? { lte: new Date(String(to)) } : {}) } } : {}),
  };

  // Basic search on intent id or providerRef
  if (q) {
    where.OR = [
      { id: { contains: String(q) } },
      { providerRef: { contains: String(q) } },
    ];
  }

  const items = await prisma.paymentIntent.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
    include: { user: { select: { id: true, username: true, email: true, phone: true } } },
  });
  const hasMore = items.length > take;
  const sliced = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.id : null;
  res.json({ items: sliced, nextCursor });
});

app.get('/admin/payments/intents/:id', authRequired, staffOnly, async (req, res) => {
  const id = req.params.id;
  const intent = await prisma.paymentIntent.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, email: true, phone: true } },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!intent) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(intent);
});

// Export CSV (simple)
app.get('/admin/payments/export.csv', authRequired, staffOnly, async (req, res) => {
  const { from, to } = req.query || {};
  const items = await prisma.paymentIntent.findMany({
    where: {
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(String(from)) } : {}), ...(to ? { lte: new Date(String(to)) } : {}) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="payment_intents.csv"');

  const header = ['id','userId','provider','status','productType','productRefId','amount','currency','country','providerRef','createdAt'].join(',');
  res.write(header + '\n');
  for (const it of items) {
    const row = [
      it.id,
      it.userId,
      it.provider,
      it.status,
      it.productType,
      it.productRefId || '',
      it.amount,
      it.currency,
      it.country,
      it.providerRef || '',
      it.createdAt.toISOString(),
    ].map(v => String(v).replace(/"/g,'""'));
    res.write(row.map(v => `"${v}"`).join(',') + '\n');
  }
  res.end();
});

// Revenue KPIs (grouped)
app.get('/admin/payments/revenue', authRequired, staffOnly, async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();

  // Basic aggregation: count + sum by provider/status/productType and daily totals
  const totals = await prisma.paymentIntent.groupBy({
    by: ['provider', 'status', 'productType'],
    where: { createdAt: { gte: from, lte: to } },
    _count: { _all: true },
    _sum: { amount: true },
  });

  // Daily successful sums
  const daily = await prisma.$queryRaw`
    SELECT date_trunc('day', "createdAt") as day,
           "provider" as provider,
           SUM("amount")::int as amount
    FROM "PaymentIntent"
    WHERE "createdAt" BETWEEN ${from} AND ${to}
      AND "status" = 'SUCCESS'
    GROUP BY 1,2
    ORDER BY 1 ASC;
  `;

  res.json({ range: { from: from.toISOString(), to: to.toISOString() }, totals, daily });
});

// Admin: Jobs / Queue health (Step 4.5)
app.get('/admin/jobs/health', authRequired, staffOnly, async (req, res) => {
  const [pendingIntents, initiatedIntents] = await Promise.all([
    prisma.paymentIntent.count({ where: { status: 'PENDING' } }),
    prisma.paymentIntent.count({ where: { status: 'INITIATED' } }),
  ]);
  const counts = await paymentsQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
  res.json({ ok: true, queue: counts, intents: { pending: pendingIntents, initiated: initiatedIntents } });
});

// Refund Stripe payment
app.post('/admin/payments/intents/:id/refund', authRequired, staffOnly, async (req, res) => {
  const id = req.params.id;
  if (!stripe) return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED' });
  const intent = await prisma.paymentIntent.findUnique({ where: { id } });
  if (!intent) return res.status(404).json({ error: 'NOT_FOUND' });
  if (intent.provider !== 'STRIPE') return res.status(400).json({ error: 'NOT_STRIPE_INTENT' });
  if (intent.status !== 'SUCCESS') return res.status(400).json({ error: 'NOT_REFUNDABLE', status: intent.status });

  // Find the Stripe payment_intent id.
  let stripePi = intent.providerData?.stripePaymentIntentId || null;
  if (!stripePi && intent.providerRef) {
    const session = await stripe.checkout.sessions.retrieve(intent.providerRef);
    stripePi = session?.payment_intent || null;
  }
  if (!stripePi) return res.status(400).json({ error: 'MISSING_STRIPE_PAYMENT_INTENT' });

  const refund = await stripe.refunds.create({ payment_intent: String(stripePi) });
  // store refund as event (idempotent)
  await createPaymentEventOnce({ provider: 'STRIPE', eventId: refund.id, intentId: intent.id, payload: refund });
  await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'REFUNDED', providerData: { ...(intent.providerData || {}), stripeRefundId: refund.id } } });
  await alertForPaymentStatus(intent.id, 'REFUNDED', { source: 'admin.refund', refundId: refund.id });
  await logAdminAction(req, { action: 'payment.refund', entityType: 'PaymentIntent', entityId: intent.id, meta: { refundId: refund.id } });
  res.json({ ok: true, refundId: refund.id, status: 'REFUNDED' });
});

// Reconciliation: stuck intents
app.get('/admin/reconciliation/stuck', authRequired, staffOnly, async (req, res) => {
  const minutes = Math.min(Math.max(parseInt(String(req.query.minutes || '15'), 10) || 15, 1), 24 * 60);
  const provider = req.query.provider ? String(req.query.provider) : null;
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const items = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['INITIATED', 'PENDING'] },
      createdAt: { lte: since },
      ...(provider ? { provider } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { user: { select: { id: true, username: true } } },
  });
  res.json({ minutes, items });
});

// Re-verify intent status (Stripe/Orange; MTN can be added when MTN verify is enabled)
app.post('/admin/reconciliation/:id/reverify', authRequired, staffOnly, async (req, res) => {
  const id = req.params.id;
  const intent = await prisma.paymentIntent.findUnique({ where: { id } });
  if (!intent) return res.status(404).json({ error: 'NOT_FOUND' });

  if (intent.provider === 'STRIPE') {
    if (!stripe) return res.status(500).json({ error: 'STRIPE_NOT_CONFIGURED' });
    if (!intent.providerRef) return res.status(400).json({ error: 'MISSING_STRIPE_SESSION' });
    const session = await stripe.checkout.sessions.retrieve(intent.providerRef);
    const paid = session?.payment_status === 'paid';
    if (paid) {
      await prisma.paymentIntent.update({ where: { id }, data: { status: 'SUCCESS', providerData: { ...(intent.providerData || {}), stripePaymentIntentId: String(session.payment_intent || '') } } });
      await paymentsQueue.add('process_intent', { intentId: id }, { jobId: `intent:${id}`, removeOnComplete: 200, removeOnFail: 200 });
      return res.json({ ok: true, status: 'SUCCESS' });
    }
    const expired = session?.status === 'expired';
    if (expired) {
      await prisma.paymentIntent.update({ where: { id }, data: { status: 'CANCELLED' } });
      return res.json({ ok: true, status: 'CANCELLED' });
    }
    return res.json({ ok: true, status: intent.status, stripe: { status: session?.status, payment_status: session?.payment_status } });
  }

  if (intent.provider === 'ORANGE' && intent.providerRef) {
    try {
      const st = await orangeGetPaymentStatus({
        payToken: intent.providerRef,
        orderId: intent.providerData?.orangeOrderId || intent.id,
        country: intent.country || 'CM',
      });
      const rawStatus = (st.status || st.transactionStatus || st.confirmtxnstatus || '').toString().toUpperCase();
      const isSuccess = rawStatus.includes('SUCCESS') || rawStatus.includes('OK');
      const isFail = rawStatus.includes('FAIL') || rawStatus.includes('CANCEL') || rawStatus.includes('REJECT');
      if (isSuccess) {
        await prisma.paymentIntent.update({ where: { id }, data: { status: 'SUCCESS', providerData: { ...(intent.providerData || {}), orangeStatus: st } } });
        await fulfillPaymentIntent(id);
        await paymentsQueue.add('process_intent', { intentId: id }, { jobId: `intent:${id}`, removeOnComplete: 200, removeOnFail: 200 });
        return res.json({ ok: true, status: 'SUCCESS' });
      }
      if (isFail) {
        await prisma.paymentIntent.update({ where: { id }, data: { status: 'FAILED', providerData: { ...(intent.providerData || {}), orangeStatus: st } } });
        await alertForPaymentStatus(id, 'FAILED', { source: 'admin.reverify' });
        return res.json({ ok: true, status: 'FAILED' });
      }
      return res.json({ ok: true, status: intent.status, orange: st });
    } catch (e) {
      return res.status(500).json({ error: 'ORANGE_VERIFY_FAILED' });
    }
  }

  if (intent.provider === 'MTN' && intent.providerRef) {
    try {
      const st = await mtnGetPaymentStatus(intent.providerRef);
      const parsed = parseMtnStatus(st);
      if (parsed.isSuccess) {
        await prisma.paymentIntent.update({ where: { id }, data: { status: 'SUCCESS', providerData: { ...(intent.providerData || {}), mtnStatus: st } } });
        await fulfillPaymentIntent(id);
        await paymentsQueue.add('process_intent', { intentId: id }, { jobId: `intent:${id}`, removeOnComplete: 200, removeOnFail: 200 });
        return res.json({ ok: true, status: 'SUCCESS', reason: parsed.reason, insufficientFunds: parsed.insufficientFunds });
      }
      if (parsed.isFail) {
        await prisma.paymentIntent.update({ where: { id }, data: { status: 'FAILED', providerData: { ...(intent.providerData || {}), mtnStatus: st } } });
        await alertForPaymentStatus(id, 'FAILED', { source: 'admin.reverify', reason: parsed.reason });
        return res.json({ ok: true, status: 'FAILED', reason: parsed.reason, insufficientFunds: parsed.insufficientFunds });
      }
      return res.json({ ok: true, status: intent.status, mtn: st, reason: parsed.reason, insufficientFunds: parsed.insufficientFunds });
    } catch (e) {
      return res.status(500).json({ error: 'MTN_VERIFY_FAILED' });
    }
  }

  return res.json({ ok: true, status: intent.status, message: 'No verifier configured for this provider yet.' });
});

app.post('/admin/reconciliation/:id/cancel', authRequired, staffOnly, async (req, res) => {
  const id = req.params.id;
  const intent = await prisma.paymentIntent.findUnique({ where: { id } });
  if (!intent) return res.status(404).json({ error: 'NOT_FOUND' });
  if (intent.status === 'SUCCESS') return res.status(400).json({ error: 'CANNOT_CANCEL_SUCCESS' });
  await prisma.paymentIntent.update({ where: { id }, data: { status: 'CANCELLED' } });
  res.json({ ok: true, status: 'CANCELLED' });
});

// MTN webhook/callback (provider-specific payload varies; keep generic + idempotent)
app.post('/payments/webhook/mtn', async (req, res) => {
  const payload = req.body || {};
  const providerRef = payload.reference || payload.providerRef || payload['X-Reference-Id'] || payload.ref || null;
  const eventId = payload.eventId || providerRef || uuid();

  if (!providerRef) return res.status(400).json({ error: 'MISSING_REFERENCE' });

  const intent = await prisma.paymentIntent.findFirst({ where: { provider: 'MTN', providerRef } });
  if (!intent) return res.status(404).json({ error: 'INTENT_NOT_FOUND' });

  const created = await createPaymentEventOnce({ provider: 'MTN', eventId, intentId: intent.id, payload });
  if (!created) return res.json({ ok: true });

  const rawStatus = (payload.status || payload.transactionStatus || payload.result?.status || '').toString().toUpperCase();
  const isSuccess = rawStatus.includes('SUCCESS') || rawStatus.includes('COMPLETED');
  const isCancelled = rawStatus.includes('CANCEL');
  const isFail = rawStatus.includes('FAIL') || rawStatus.includes('REJECT');
  if (isSuccess) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCESS' } });
    await fulfillPaymentIntent(intent.id);
    await paymentsQueue.add('process_intent', { intentId: intent.id }, { jobId: `intent:${intent.id}`, removeOnComplete: 200, removeOnFail: 200 });
  } else if (isCancelled) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'CANCELLED' } });
  } else if (isFail) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } });
    if (isFail) {
      await alertForPaymentStatus(intent.id, 'FAILED', { source: 'mtn.webhook' });
    }
  }

  return res.json({ ok: true });
});

// Orange webhook/notif
app.post('/payments/webhook/orange', async (req, res) => {
  const payload = req.body || {};
  const providerRef = payload.payToken
    || payload.pay_token
    || payload.notif_token
    || payload.notifToken
    || payload.orderId
    || payload.order_id
    || payload.transactionId
    || payload.reference
    || payload.ref
    || null;
  const eventId = payload.eventId || providerRef || uuid();

  if (!providerRef) return res.status(400).json({ error: 'MISSING_REFERENCE' });

  const intent = await prisma.paymentIntent.findFirst({ where: { provider: 'ORANGE', providerRef } });
  if (!intent) return res.status(404).json({ error: 'INTENT_NOT_FOUND' });

  const created = await createPaymentEventOnce({ provider: 'ORANGE', eventId, intentId: intent.id, payload });
  if (!created) return res.json({ ok: true });

  const rawStatus = (payload.status || payload.transactionStatus || payload.confirmtxnstatus || '').toString().toUpperCase();
  const isSuccess = rawStatus.includes('SUCCESS') || rawStatus.includes('OK') || rawStatus.includes('COMPLETED');
  const isCancelled = rawStatus.includes('CANCEL');
  const isFail = rawStatus.includes('FAIL') || rawStatus.includes('REJECT');

  if (isSuccess) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCESS' } });
    await fulfillPaymentIntent(intent.id);
    await paymentsQueue.add('process_intent', { intentId: intent.id }, { jobId: `intent:${intent.id}`, removeOnComplete: 200, removeOnFail: 200 });
  } else if (isCancelled) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'CANCELLED' } });
  } else if (isFail) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } });
    await alertForPaymentStatus(intent.id, 'FAILED', { source: 'orange.webhook' });
  }

  return res.json({ ok: true });
});


app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    startedAt: APP_STARTED_AT.toISOString(),
    version: APP_VERSION || undefined,
  });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, ready: true });
  } catch (err) {
    logger.error({ err }, 'health_ready_failed');
    res.status(503).json({ ok: false, ready: false });
  }
});

// --------------------
// Auth (user)
// --------------------
app.post('/auth/register', rateLimitRegister, captchaGuard, async (req, res) => {
  const { email, phone, password, username, city = 'Douala', country = 'CM', ageConfirmed } = req.body || {};
  if (!password || (!email && !phone) || !username) return res.status(400).json({ error: 'INVALID_INPUT' });
  if (ageConfirmed !== true) return res.status(400).json({ error: 'AGE_CONFIRM_REQUIRED' });
  try {
    assertNoForbiddenWords(username, 'username');
  } catch (e) {
    return res.status(400).json({ error: e.code || 'FORBIDDEN_WORDS', details: e.details || null });
  }

  const exists = await prisma.user.findFirst({
    where: {
      OR: [
        email ? { email } : undefined,
        phone ? { phone } : undefined,
        { username },
      ].filter(Boolean),
    },
  });
  if (exists) return res.status(409).json({ error: 'ALREADY_EXISTS' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: email || null, phone: phone || null, passwordHash, username, city, country, role: 'user' },
  });
  await ensureWalletForUser(user.id);
  void recordAnalyticsEvent({
    name: 'user.register',
    source: 'api',
    userId: user.id,
    meta: { method: email ? 'email' : 'phone', country },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  res.status(201).json({ token: signToken(user), user: { id: user.id, role: user.role, username: user.username } });
});

app.post('/auth/login', rateLimitLogin, async (req, res) => {
  const { emailOrPhone, password } = req.body || {};
  if (!emailOrPhone || !password) return res.status(400).json({ error: 'INVALID_INPUT' });

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrPhone }, { phone: emailOrPhone }, { username: emailOrPhone }],
    },
  });
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  if (user.role === 'user') {
    const security = await prisma.userSecurity.findUnique({ where: { userId: user.id } });
    if (security?.isBanned) {
      return res.status(403).json({ error: 'BANNED', reason: security.banReason || null, bannedAt: security.bannedAt || null });
    }
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
    await ensureWalletForUser(user.id);

  if (ok) {
    void recordAnalyticsEvent({
      name: 'user.login',
      source: 'api',
      userId: user.id,
      meta: { method: emailOrPhone.includes('@') ? 'email' : 'phone' },
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
  }
  res.json({ token: signToken(user), user: { id: user.id, role: user.role, username: user.username } });
});

app.post('/auth/forgot-password', async (req, res) => {
  const { emailOrPhone } = req.body || {};
  const identifier = emailOrPhone ? String(emailOrPhone).trim() : '';
  if (!identifier) return res.status(400).json({ error: 'INVALID_INPUT' });

  const lookupEmail = identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: lookupEmail },
        { phone: identifier },
        { username: identifier },
      ],
    },
  });

  if (!user) return res.json({ ok: true });

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);
  const resetUrl = buildResetUrl(token);

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  let delivered = false;
  if (user.email) {
    delivered = await sendResetEmail({ to: user.email, resetUrl, token, lang: user.language || 'fr' });
  }

  if (SENDGRID_API_KEY && SENDGRID_FROM && delivered) {
    return res.json({ ok: true, delivered, expiresAt });
  }

  return res.json({ ok: true, delivered, resetToken: token, resetUrl, expiresAt });
});

app.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'INVALID_INPUT' });
  if (String(password).length < 6) return res.status(400).json({ error: 'WEAK_PASSWORD' });

  const tokenHash = hashResetToken(String(token));
  const reset = await prisma.passwordReset.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!reset) return res.status(400).json({ error: 'INVALID_TOKEN' });

  const passwordHash = await bcrypt.hash(String(password), 10);
  await prisma.user.update({
    where: { id: reset.userId },
    data: { passwordHash },
  });

  await prisma.passwordReset.update({
    where: { id: reset.id },
    data: { usedAt: new Date() },
  });

  res.json({ ok: true });
});

app.get('/me', authRequired, async (req, res) => {
  const sub = await getActiveSubscription(req.user.id);
  res.json({
    id: req.user.id,
    role: req.user.role,
    username: req.user.username,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    bio: req.user.bio,
    avatarUrl: req.user.avatarUrl,
    coverUrl: req.user.coverUrl,
    website: req.user.website,
    whatsapp: req.user.whatsapp,
    instagram: req.user.instagram,
    telegram: req.user.telegram,
    language: req.user.language,
    notificationsEmail: req.user.notificationsEmail,
    notificationsPush: req.user.notificationsPush,
    notificationsSms: req.user.notificationsSms,
    emailVerified: req.user.emailVerified,
    phoneVerified: req.user.phoneVerified,
    showEmail: req.user.showEmail,
    showPhone: req.user.showPhone,
    allowMessages: req.user.allowMessages,
    allowCalls: req.user.allowCalls,
    email: req.user.email,
    phone: req.user.phone,
    city: req.user.city,
    country: req.user.country,
    isPro: Boolean(sub),
    pro: sub ? { plan: sub.plan, endAt: sub.endAt } : null,
  });
});

app.put('/me', authRequired, async (req, res) => {
  const {
    username,
    firstName,
    lastName,
    bio,
    avatarUrl,
    coverUrl,
    website,
    whatsapp,
    instagram,
    telegram,
    language,
    notificationsEmail,
    notificationsPush,
    notificationsSms,
    showEmail,
    showPhone,
    allowMessages,
    allowCalls,
    email,
    phone,
    city,
    country,
    password,
  } = req.body || {};

  const parseBool = (value) => value === true || value === 'true' || value === 1 || value === '1';
  const data = {};
  const cleanedUsername = username !== undefined ? String(username).trim() : undefined;
  const cleanedCity = city !== undefined ? String(city).trim() : undefined;
  const cleanedCountry = country !== undefined ? String(country).trim().toUpperCase() : undefined;

  if (cleanedUsername !== undefined && !cleanedUsername) return res.status(400).json({ error: 'INVALID_USERNAME' });
  if (cleanedCity !== undefined && !cleanedCity) return res.status(400).json({ error: 'INVALID_CITY' });
  if (cleanedCountry !== undefined && !cleanedCountry) return res.status(400).json({ error: 'INVALID_COUNTRY' });

  if (cleanedUsername !== undefined) data.username = cleanedUsername;
  if (email !== undefined) data.email = email ? String(email).trim().toLowerCase() : null;
  if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
  if (cleanedCity !== undefined) data.city = cleanedCity;
  if (cleanedCountry !== undefined) data.country = cleanedCountry;
  if (firstName !== undefined) data.firstName = firstName ? String(firstName).trim() : null;
  if (lastName !== undefined) data.lastName = lastName ? String(lastName).trim() : null;
  if (bio !== undefined) data.bio = bio ? String(bio).trim() : null;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl ? String(avatarUrl).trim() : null;
  if (coverUrl !== undefined) data.coverUrl = coverUrl ? String(coverUrl).trim() : null;
  if (website !== undefined) data.website = website ? String(website).trim() : null;
  if (whatsapp !== undefined) data.whatsapp = whatsapp ? String(whatsapp).trim() : null;
  if (instagram !== undefined) data.instagram = instagram ? String(instagram).trim() : null;
  if (telegram !== undefined) data.telegram = telegram ? String(telegram).trim() : null;
  if (language !== undefined) data.language = String(language).trim() || 'fr';
  if (notificationsEmail !== undefined) data.notificationsEmail = parseBool(notificationsEmail);
  if (notificationsPush !== undefined) data.notificationsPush = parseBool(notificationsPush);
  if (notificationsSms !== undefined) data.notificationsSms = parseBool(notificationsSms);
  if (showEmail !== undefined) data.showEmail = parseBool(showEmail);
  if (showPhone !== undefined) data.showPhone = parseBool(showPhone);
  if (allowMessages !== undefined) data.allowMessages = parseBool(allowMessages);
  if (allowCalls !== undefined) data.allowCalls = parseBool(allowCalls);
  if (password) data.passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({
      id: user.id,
      role: user.role,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      website: user.website,
      whatsapp: user.whatsapp,
      instagram: user.instagram,
      telegram: user.telegram,
      language: user.language,
      notificationsEmail: user.notificationsEmail,
      notificationsPush: user.notificationsPush,
      notificationsSms: user.notificationsSms,
      showEmail: user.showEmail,
      showPhone: user.showPhone,
      allowMessages: user.allowMessages,
      allowCalls: user.allowCalls,
      email: user.email,
      phone: user.phone,
      city: user.city,
      country: user.country,
    });
  } catch (err) {
    const code = err?.code || err?.errorCode;
    if (code === 'P2002') {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target[0] : 'field';
      return res.status(409).json({ error: 'ALREADY_EXISTS', field: target });
    }
    return res.status(500).json({ error: 'UPDATE_FAILED' });
  }
});

app.post('/me/verify-email', authRequired, async (req, res) => {
  if (!req.user.email) return res.status(400).json({ error: 'EMAIL_REQUIRED' });
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { emailVerified: true },
  });
  res.json({ ok: true, emailVerified: user.emailVerified });
});

app.post('/me/verify-phone', authRequired, async (req, res) => {
  if (!req.user.phone) return res.status(400).json({ error: 'PHONE_REQUIRED' });
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { phoneVerified: true },
  });
  res.json({ ok: true, phoneVerified: user.phoneVerified });
});

// Admin auth (same users table; must be role=admin)
app.post('/admin/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'INVALID_INPUT' });
  const user = await prisma.user.findFirst({ where: { email, role: 'admin' } });
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  res.json({ token: signToken(user), user: { id: user.id, role: user.role, username: user.username } });
});

// --------------------
// Media
// --------------------
app.post('/media/upload', authRequired, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'NO_FILE' });
  const url = `/uploads/${file.filename}`;
  res.status(201).json({ url, mime: file.mimetype, size: file.size, originalName: file.originalname });
});

// --------------------
// Categories + forms
// --------------------
app.get('/categories/tree', async (_req, res) => {
  const items = await prisma.category.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  // build tree
  const byId = new Map(items.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parentId) {
      const p = byId.get(c.parentId);
      if (p) p.children.push(c);
      else roots.push(c);
    } else roots.push(c);
  }
  res.json({ items: roots });
});

app.get('/categories/:slug/form', async (req, res) => {
  const slug = req.params.slug;
  const cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) return res.status(404).json({ error: 'NOT_FOUND' });

  const steps = await prisma.formStep.findMany({
    where: { categoryId: cat.id },
    orderBy: { order: 'asc' },
    include: { fields: { orderBy: { createdAt: 'asc' } } },
  });
  res.json({ category: { id: cat.id, slug: cat.slug, name: cat.name }, steps });
});

app.get('/categories/:categoryId/steps', async (req, res) => {
  const categoryId = req.params.categoryId;
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) return res.status(404).json({ error: 'NOT_FOUND' });

  const steps = await prisma.formStep.findMany({
    where: { categoryId },
    orderBy: { order: 'asc' },
    include: { fields: { orderBy: { createdAt: 'asc' } } },
  });
  res.json({ category: { id: cat.id, slug: cat.slug, name: cat.name }, steps });
});

app.get('/steps/:stepId/fields', async (req, res) => {
  const stepId = req.params.stepId;
  const items = await prisma.formField.findMany({
    where: { stepId },
    orderBy: { createdAt: 'asc' },
  });
  console.log('items', items);
  res.json({ items });
});

app.get('/step/:stepId/fields', async (req, res) => {
  const stepId = req.params.stepId;
  const items = await prisma.formField.findMany({
    where: { stepId },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ items });
});

// --------------------
// Monetization config (public)
// --------------------
// Used by the UI to display publish cost / quotas before submit.
app.get('/monetization/publish-config', async (req, res) => {
  const country = String(req.query.country || 'CM').toUpperCase();
  const categorySlug = (req.query.categorySlug || '').toString() || null;
  const pricing = await getPricing({ action: 'PUBLISH_AD', country, categorySlug });
  const quota = await getQuota({ action: 'PUBLISH_AD', country, categorySlug, role: 'user' });
  const user = await getOptionalUser(req);
  const isPro = await resolveProStatus(user);
  const standardCost = pricing?.creditsCost || 0;
  const costCredits = applyProDiscount(standardCost, isPro);
  res.json({
    action: 'PUBLISH_AD',
    costCredits,
    standardCostCredits: standardCost,
    currency: pricing?.currency || 'XAF',
    maxPerDay: isPro ? null : (quota?.maxPerDay || null),
    isPro,
    discountRate: isPro ? PRO_DISCOUNT_RATE : 0,
  });
});

// Step 2: boost config (public)
// UI calls this to compute the credit cost for a boost before purchasing.
app.get('/monetization/boost-config', async (req, res) => {
  const country = String(req.query.country || 'CM').toUpperCase();
  const categorySlug = (req.query.categorySlug || '').toString() || null;
  const type = String(req.query.type || 'VIP').toUpperCase();
  const durationHours = Math.max(parseInt(String(req.query.durationHours || '24'), 10) || 24, 1);

  const actionMap = {
    VIP: 'BOOST_VIP',
    URGENT: 'BOOST_URGENT',
    TOP: 'BOOST_TOP',
    HOME: 'BOOST_HOME',
  };
  const action = actionMap[type] || 'BOOST_VIP';

  const pricing = await getPricing({ action, country, categorySlug });
  const base = pricing?.creditsCost || 0;

  // Simple multiplier by duration (configurable later in DB).
  const mult = durationHours <= 24 ? 1 : durationHours <= 72 ? 2 : durationHours <= 168 ? 4 : Math.ceil(durationHours / 48);
  const standardCost = base * mult;
  const user = await getOptionalUser(req);
  const isPro = await resolveProStatus(user);
  const costCredits = applyProDiscount(standardCost, isPro);

  res.json({
    action,
    type,
    durationHours,
    baseCreditsCost: base,
    standardCostCredits: standardCost,
    costCredits,
    currency: pricing?.currency || 'XAF',
    isPro,
    discountRate: isPro ? PRO_DISCOUNT_RATE : 0,
  });
});

// Admin CRUD categories
app.get('/admin/categories', authRequired, adminOnly, async (_req, res) => {
  const items = await prisma.category.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  res.json({ items });
});

app.post('/admin/categories', authRequired, adminOnly, async (req, res) => {
  const { name, slug, parentId = null, position = 0, isActive = true, icon = null, color = null, gradient = null } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: 'INVALID_INPUT' });
  const c = await prisma.category.create({ data: { name, slug, parentId, position, isActive, icon, color, gradient } });
  res.status(201).json({ item: c });
});

app.put('/admin/categories/:id', authRequired, adminOnly, async (req, res) => {
  const id = req.params.id;
  const data = req.body || {};
  const c = await prisma.category.update({ where: { id }, data });
  res.json({ item: c });
});

app.delete('/admin/categories/:id', authRequired, adminOnly, async (req, res) => {
  const id = req.params.id;
  await prisma.category.delete({ where: { id } });
  res.json({ ok: true });
});

// Admin: steps/fields builder
app.get('/admin/categories/:categoryId/steps', authRequired, adminOnly, async (req, res) => {
  const categoryId = req.params.categoryId;
  const items = await prisma.formStep.findMany({ where: { categoryId }, orderBy: { order: 'asc' } });
  res.json({ items });
});

app.post('/admin/categories/:categoryId/steps', authRequired, adminOnly, async (req, res) => {
  const categoryId = req.params.categoryId;
  const { name, label, order = 0, info = null, flow = null } = req.body || {};
  if (!name || !label) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.formStep.create({ data: { categoryId, name, label, order, info, flow } });
  res.status(201).json({ item });
});

app.put('/admin/steps/:id', authRequired, adminOnly, async (req, res) => {
  const item = await prisma.formStep.update({ where: { id: req.params.id }, data: req.body || {} });
  res.json({ item });
});

app.delete('/admin/steps/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.formStep.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

app.get('/admin/steps/:stepId/fields', authRequired, adminOnly, async (req, res) => {
  const stepId = req.params.stepId;
  const items = await prisma.formField.findMany({ where: { stepId }, orderBy: { createdAt: 'asc' } });
  res.json({ items });
});

app.post('/admin/steps/:stepId/fields', authRequired, adminOnly, async (req, res) => {
  const stepId = req.params.stepId;
  const { name, label, type = 'text', unit = null, values = null, rules = null, info = null, disabled = false } = req.body || {};
  if (!name || !label) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.formField.create({ data: { stepId, name, label, type, unit, values, rules, info, disabled } });
  res.status(201).json({ item });
});

app.put('/admin/fields/:id', authRequired, adminOnly, async (req, res) => {
  const item = await prisma.formField.update({ where: { id: req.params.id }, data: req.body || {} });
  res.json({ item });
});

app.delete('/admin/fields/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.formField.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// --------------------
// Admin users
// --------------------
app.get('/admin/users', authRequired, adminOnly, async (req, res) => {
  const { search, role, country, take = '20', offset = '0' } = req.query;
  const limit = Math.min(parseInt(String(take), 10) || 20, 200);
  const skip = Math.max(parseInt(String(offset), 10) || 0, 0);
  const q = String(search || '').trim();
  const where = {
    ...(role ? { role: String(role) } : {}),
    ...(country ? { country: String(country).toUpperCase() } : {}),
    ...(q ? {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        // firstName/lastName intentionally excluded to avoid schema mismatch
      ],
    } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        username: true,
        city: true,
        country: true,
        createdAt: true,
        updatedAt: true,
        creditWallet: { select: { id: true, balance: true } },
        _count: { select: { ads: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const securityItems = await prisma.userSecurity.findMany({
    where: { userId: { in: items.map((item) => item.id) } },
  });
  const securityMap = new Map(securityItems.map((item) => [item.userId, item]));
  const enriched = items.map((item) => ({ ...item, security: securityMap.get(item.id) || null }));
  res.json({ items: enriched, total });
});

app.get('/admin/users/:userId', authRequired, adminOnly, async (req, res) => {
  const { userId } = req.params;
  const item = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      phone: true,
      username: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      website: true,
      whatsapp: true,
      instagram: true,
      telegram: true,
      language: true,
      city: true,
      country: true,
      createdAt: true,
      updatedAt: true,
      creditWallet: { select: { id: true, balance: true } },
      ads: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true, createdAt: true, categorySlug: true, city: true, country: true },
      },
      _count: { select: { ads: true, creditTransactions: true } },
    },
  });
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  const security = await prisma.userSecurity.findUnique({ where: { userId } });
  res.json({ item: { ...item, security: security || null } });
});

app.put('/admin/users/:userId', authRequired, adminOnly, async (req, res) => {
  const { userId } = req.params;
  const body = req.body || {};
  const update = {};
  const role = String(body.role || '').toLowerCase();
  if (['user', 'admin', 'moderator'].includes(role)) update.role = role;
  if (typeof body.username === 'string') update.username = body.username.trim();
  if (typeof body.email === 'string') update.email = body.email.trim() || null;
  if (typeof body.phone === 'string') update.phone = body.phone.trim() || null;
  if (typeof body.city === 'string') update.city = body.city.trim() || '';
  if (typeof body.country === 'string') update.country = body.country.trim().toUpperCase() || 'CM';
  if (typeof body.bio === 'string') update.bio = body.bio.trim() || null;
  if (typeof body.avatarUrl === 'string') update.avatarUrl = body.avatarUrl.trim() || null;
  if (typeof body.coverUrl === 'string') update.coverUrl = body.coverUrl.trim() || null;
  if (typeof body.website === 'string') update.website = body.website.trim() || null;
  if (typeof body.whatsapp === 'string') update.whatsapp = body.whatsapp.trim() || null;
  if (typeof body.instagram === 'string') update.instagram = body.instagram.trim() || null;
  if (typeof body.telegram === 'string') update.telegram = body.telegram.trim() || null;
  if (typeof body.language === 'string') update.language = body.language.trim() || 'fr';

  const item = await prisma.user.update({
    where: { id: userId },
    data: update,
    select: {
      id: true,
      role: true,
      email: true,
      phone: true,
      username: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      website: true,
      whatsapp: true,
      instagram: true,
      telegram: true,
      language: true,
      city: true,
      country: true,
      createdAt: true,
      updatedAt: true,
      creditWallet: { select: { id: true, balance: true } },
      _count: { select: { ads: true, creditTransactions: true } },
    },
  });
  await logAdminAction(req, { action: 'user.update', entityType: 'User', entityId: userId, meta: Object.keys(update) });
  res.json({ item });
});

// --------------------
// Ads
// --------------------
app.get('/ads', async (req, res) => {
  const {
    q,
    status = 'PUBLISHED',
    country,
    city,
    categorySlug,
    cursor,
    limit,
    badges,
    minPrice,
    maxPrice,
    tags,
    sort,
    lat,
    lng,
    radiusKm,
  } = req.query;
  const badgeSet = new Set();
  const addBadge = (value) => {
    const item = String(value || '').trim();
    if (item) badgeSet.add(item.toUpperCase());
  };
  if (Array.isArray(badges)) {
    badges.forEach((b) => String(b).split(',').forEach(addBadge));
  } else if (badges) {
    String(badges).split(',').forEach(addBadge);
  }
  const badgeList = badgeSet.size ? Array.from(badgeSet) : null;
  const take = Math.min(parseInt(limit || '20', 10) || 20, 50);
  const priceMin = parseNumber(minPrice);
  const priceMax = parseNumber(maxPrice);
  const tagList = normalizeTags(tags);
  const centerLat = parseNumber(lat);
  const centerLng = parseNumber(lng);
  const radius = Math.max(parseNumber(radiusKm) || 0, 0);
  const sortMode = String(sort || '').toLowerCase();
  const where = {
    status: status ? String(status) : undefined,
    country: country ? String(country) : undefined,
    city: city ? String(city) : undefined,
    categorySlug: categorySlug ? String(categorySlug) : undefined,
    badges: badgeList ? { hasSome: badgeList } : undefined,
    tags: tagList.length ? { hasSome: tagList } : undefined,
    price: priceMin !== null || priceMax !== null ? {
      ...(priceMin !== null ? { gte: Math.round(priceMin) } : {}),
      ...(priceMax !== null ? { lte: Math.round(priceMax) } : {}),
    } : undefined,
    OR: q ? [{ title: { contains: String(q), mode: 'insensitive' } }, { description: { contains: String(q), mode: 'insensitive' } }] : undefined,
  };
  const andFilters = [];
  if (centerLat !== null && centerLng !== null && radius > 0) {
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos((centerLat * Math.PI) / 180));
    andFilters.push({ lat: { not: null, gte: centerLat - latDelta, lte: centerLat + latDelta } });
    andFilters.push({ lng: { not: null, gte: centerLng - lngDelta, lte: centerLng + lngDelta } });
  }
  if (andFilters.length) where.AND = andFilters;

  // Step 2: Boost-aware ordering (HOME > TOP > VIP > URGENT), then createdAt.
  // Prisma can't easily sort by filtered relation in a single query; we fetch a bit more and sort in-memory.
  const fetchTake = Math.min(take * 4, 120);
  const [items, totalCount] = await prisma.$transaction([
    prisma.ad.findMany({
      where,
      include: { media: true, boosts: true },
      orderBy: { createdAt: 'desc' },
      take: fetchTake + 1,
      ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
    }),
    prisma.ad.count({ where }),
  ]);

  let scored = items
    .map((ad) => {
      const { types } = computeActiveBoostBadges(ad.boosts);
      const distance = (centerLat !== null && centerLng !== null && ad.lat !== null && ad.lng !== null)
        ? haversineKm(centerLat, centerLng, ad.lat, ad.lng)
        : null;
      return { ad, score: boostScoreFromTypes(types), distance };
    });

  if (centerLat !== null && centerLng !== null && radius > 0) {
    scored = scored.filter((item) => item.distance !== null && item.distance <= radius);
  }

  if (sortMode === 'fresh') {
    scored.sort((a, b) => new Date(b.ad.createdAt).getTime() - new Date(a.ad.createdAt).getTime());
  } else if (sortMode === 'distance' && centerLat !== null && centerLng !== null) {
    scored.sort((a, b) => {
      const ad = a.distance ?? Number.POSITIVE_INFINITY;
      const bd = b.distance ?? Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.ad.createdAt).getTime() - new Date(a.ad.createdAt).getTime();
    });
  } else {
    scored.sort((a, b) => (b.score - a.score) || (new Date(b.ad.createdAt).getTime() - new Date(a.ad.createdAt).getTime()));
  }

  const sorted = scored.map((x) => x.ad);

  const nextCursor = sorted.length > take ? sorted[take].id : null;
  const page = sorted.slice(0, take).map(publicAdView);
  const adjustedTotal = (centerLat !== null && centerLng !== null && radius > 0) ? sorted.length : totalCount;
  res.json({ items: page, nextCursor, totalCount: adjustedTotal });
});

app.get('/ads/recommendations', async (req, res) => {
  const { categorySlug, city, tags, exclude, country, limit } = req.query;
  const take = Math.min(parseInt(limit || '12', 10) || 12, 40);
  const tagList = normalizeTags(tags);
  const or = [];
  if (categorySlug) or.push({ categorySlug: String(categorySlug) });
  if (city) or.push({ city: String(city) });
  if (tagList.length) or.push({ tags: { hasSome: tagList } });

  const where = {
    status: 'PUBLISHED',
    ...(country ? { country: String(country) } : {}),
    ...(exclude ? { id: { not: String(exclude) } } : {}),
    ...(or.length ? { OR: or } : {}),
  };

  const items = await prisma.ad.findMany({
    where,
    include: { media: true, boosts: true },
    orderBy: { createdAt: 'desc' },
    take: Math.min(take * 3, 60),
  });

  const sorted = items
    .map((ad) => ({ ad, score: boostScoreFromTypes(computeActiveBoostBadges(ad.boosts).types) }))
    .sort((a, b) => (b.score - a.score) || (new Date(b.ad.createdAt).getTime() - new Date(a.ad.createdAt).getTime()))
    .slice(0, take)
    .map((x) => x.ad);

  res.json({ items: sorted.map(publicAdView) });
});

app.get('/search/suggest', async (req, res) => {
  const term = String(req.query.term || '').trim();
  const limit = Math.min(parseInt(req.query.limit || '8', 10) || 8, 20);
  const country = req.query.country ? String(req.query.country) : null;

  const [categories, cities, tagsRaw] = await prisma.$transaction([
    term
      ? prisma.category.findMany({
        where: { name: { contains: term, mode: 'insensitive' } },
        select: { slug: true, name: true },
        take: limit,
      })
      : prisma.category.findMany({ select: { slug: true, name: true }, take: limit }),
    term
      ? prisma.ad.findMany({
        where: {
          status: 'PUBLISHED',
          ...(country ? { country } : {}),
          city: { contains: term, mode: 'insensitive' },
        },
        select: { city: true },
        distinct: ['city'],
        take: limit,
      })
      : prisma.ad.findMany({
        where: { status: 'PUBLISHED', ...(country ? { country } : {}) },
        select: { city: true },
        distinct: ['city'],
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    prisma.ad.findMany({
      where: { status: 'PUBLISHED', ...(country ? { country } : {}) },
      select: { tags: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  const tagSet = new Set();
  tagsRaw.forEach((row) => {
    (row.tags || []).forEach((t) => tagSet.add(String(t)));
  });
  const tags = Array.from(tagSet)
    .filter((t) => (term ? t.toLowerCase().includes(term.toLowerCase()) : true))
    .slice(0, limit);

  res.json({
    categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
    cities: cities.map((c) => c.city).filter(Boolean),
    tags,
  });
});

app.post('/analytics/events', async (req, res) => {
  const { name, source, anonymousId, meta } = req.body || {};
  if (!name) return res.status(400).json({ error: 'INVALID_INPUT' });
  const user = await getOptionalUser(req);
  await recordAnalyticsEvent({
    name,
    source: source || 'web',
    userId: user?.id || null,
    anonymousId,
    meta,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  res.status(201).json({ ok: true });
});

app.get('/collections/top-cities', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '8', 10) || 8, 20);
  const country = req.query.country ? String(req.query.country) : null;
  const rows = await prisma.ad.groupBy({
    by: ['city'],
    where: { status: 'PUBLISHED', ...(country ? { country } : {}), city: { not: '' } },
    _count: { city: true },
    orderBy: { _count: { city: 'desc' } },
    take: limit,
  });
  res.json({ items: rows.map((r) => ({ city: r.city, count: r._count.city })) });
});

app.get('/collections/themes', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '8', 10) || 8, 20);
  const country = req.query.country ? String(req.query.country) : null;
  const rows = await prisma.ad.groupBy({
    by: ['categorySlug'],
    where: { status: 'PUBLISHED', ...(country ? { country } : {}), categorySlug: { not: '' } },
    _count: { categorySlug: true },
    orderBy: { _count: { categorySlug: 'desc' } },
    take: limit,
  });
  const slugs = rows.map((r) => r.categorySlug).filter(Boolean);
  const categories = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true },
  });
  const labelBySlug = new Map(categories.map((c) => [c.slug, c.name]));
  res.json({
    items: rows.map((r) => ({
      slug: r.categorySlug,
      label: labelBySlug.get(r.categorySlug) || r.categorySlug,
      count: r._count.categorySlug,
    })),
  });
});

app.get('/ads/mine', authRequired, async (req, res) => {
  const items = await prisma.ad.findMany({ where: { userId: req.user.id, status: { not: 'DELETED' } }, orderBy: { createdAt: 'desc' }, include: { media: true, boosts: true } });
  res.json({ items: items.map(publicAdView) });
});

app.get('/ads/:id', async (req, res) => {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.id }, include: { media: true, boosts: true } });
  if (!ad || ad.status === 'DELETED') return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(publicAdView(ad));
});

app.post('/ads', authRequired, rateLimitAdsCreate, captchaGuard, async (req, res) => {
  const { title, description = '', city, country, categorySlug, badges = [], dynamic = {}, media = [], ageConfirmed } = req.body || {};
  if (!title || !city || !country || !categorySlug) return res.status(400).json({ error: 'INVALID_INPUT' });
  if (req.user.role === 'user' && ageConfirmed !== true) return res.status(400).json({ error: 'AGE_CONFIRM_REQUIRED' });
  const ocrHits = await scanMediaForForbiddenWords({ items: media, source: 'ad.create', userId: req.user.id });
  const forbiddenHits = Array.from(new Set([
    ...findForbiddenWords(title),
    ...(description ? findForbiddenWords(description) : []),
    ...ocrHits,
  ]));
  if (forbiddenHits.length) {
    const moderation = { reason: 'FORBIDDEN_WORDS', words: forbiddenHits, detectedAt: new Date().toISOString() };
    const strike = req.user.role === 'user'
      ? await recordForbiddenStrike(req.user.id, { source: 'ad.create', words: forbiddenHits })
      : { strikes: 0, banned: false };
    const rejected = await prisma.ad.create({
      data: {
        userId: req.user.id,
        title,
        description,
        city,
        country,
        categorySlug,
        badges,
        dynamic,
        moderation,
        status: 'REJECTED',
        media: {
          create: (media || []).map((m) => ({ type: m.type || 'image', url: m.url, mime: m.mime || null, size: m.size || null })),
        },
      },
      include: { media: true },
    });
    return res.status(403).json({ error: 'FORBIDDEN_WORDS', details: { words: forbiddenHits }, adId: rejected.id, banned: strike.banned, strikes: strike.strikes });
  }
  const derivedPrice = extractPrice(dynamic);
  const derivedTags = extractTags(dynamic);
  const derivedLocation = extractLatLng(dynamic);

  // Step 1.2: pay-per-post + quotas (credits)
  // 1) Quota check (regular users only)
  const isPro = await resolveProStatus(req.user);
  const quotaRule = await getQuota({ action: 'PUBLISH_AD', country: String(country).toUpperCase(), categorySlug, role: req.user.role });
  // PRO users (active subscription) are not limited by the standard quota in this MVP.
  if (!isPro && quotaRule && quotaRule.maxPerDay > 0 && req.user.role === 'user') {
    const countToday = await prisma.ad.count({
      where: {
        userId: req.user.id,
        status: { not: 'DELETED' },
        createdAt: { gte: startOfTodayISO() },
      },
    });
    if (countToday >= quotaRule.maxPerDay) {
      return res.status(429).json({ error: 'QUOTA_EXCEEDED', maxPerDay: quotaRule.maxPerDay });
    }
  }

  // 2) Pricing check + debit credits
  const pricing = await getPricing({ action: 'PUBLISH_AD', country: String(country).toUpperCase(), categorySlug });
  const standardCost = pricing?.creditsCost || 0;
  const cost = applyProDiscount(standardCost, isPro);
  const wallet = await ensureWalletForUser(req.user.id);
  if (cost > 0 && wallet.balance < cost) {
    return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', required: cost, balance: wallet.balance });
  }

  const created = await prisma.$transaction(async (tx) => {
    // debit credits first (if any)
    if (cost > 0) {
      const w = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: cost } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: req.user.id,
          walletId: wallet.id,
          type: 'DEBIT',
          amount: cost,
          reason: 'AD_PUBLISH',
          meta: { categorySlug, country, city, title },
        },
      });
      // keep w for potential return later
      void w;
    }

    return tx.ad.create({
      data: {
        userId: req.user.id,
        title,
        description,
        city,
        country,
        categorySlug,
        badges,
        price: derivedPrice !== null ? derivedPrice : null,
        tags: derivedTags,
        lat: derivedLocation.lat,
        lng: derivedLocation.lng,
        dynamic,
        status: 'PENDING_REVIEW',
        media: {
          create: (media || []).map((m) => ({ type: m.type || 'image', url: m.url, mime: m.mime || null, size: m.size || null })),
        },
      },
      include: { media: true },
    });
  });

  void recordAnalyticsEvent({
    name: 'ad.create',
    source: 'api',
    userId: req.user.id,
    meta: { adId: created.id, categorySlug, country, city },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  res.status(201).json(publicAdView(created));
});

app.put('/ads/:id', authRequired, async (req, res) => {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.id }, include: { media: true } });
  if (!ad) return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'admin' && ad.userId !== req.user.id) return res.status(403).json({ error: 'FORBIDDEN' });

  const { title, description, city, country, categorySlug, badges, dynamic, media } = req.body || {};
  const ocrHits = media ? await scanMediaForForbiddenWords({ items: media, source: 'ad.update', userId: req.user.id }) : [];
  const forbiddenHits = Array.from(new Set([
    ...(title ? findForbiddenWords(title) : []),
    ...(description ? findForbiddenWords(description) : []),
    ...ocrHits,
  ]));
  if (forbiddenHits.length) {
    const moderation = { reason: 'FORBIDDEN_WORDS', words: forbiddenHits, detectedAt: new Date().toISOString() };
    const strike = req.user.role === 'user'
      ? await recordForbiddenStrike(req.user.id, { source: 'ad.update', words: forbiddenHits, adId: ad.id })
      : { strikes: 0, banned: false };
    const updated = await prisma.ad.update({
      where: { id: ad.id },
      data: { status: 'REJECTED', moderation },
    });
    return res.status(403).json({ error: 'FORBIDDEN_WORDS', details: { words: forbiddenHits }, adId: updated.id, banned: strike.banned, strikes: strike.strikes });
  }
  const derived = dynamic !== undefined ? {
    price: extractPrice(dynamic),
    tags: extractTags(dynamic),
    ...extractLatLng(dynamic),
  } : null;
  const mediaItems = Array.isArray(media) ? media : null;
  const updated = await prisma.ad.update({
    where: { id: ad.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(country !== undefined ? { country } : {}),
      ...(categorySlug !== undefined ? { categorySlug } : {}),
      ...(badges !== undefined ? { badges } : {}),
      ...(dynamic !== undefined ? { dynamic } : {}),
      ...(derived ? {
        price: derived.price !== null ? derived.price : null,
        tags: derived.tags || [],
        lat: derived.lat,
        lng: derived.lng,
      } : {}),
      ...(mediaItems ? {
        media: {
          deleteMany: {},
          create: mediaItems.map((m) => ({
            type: m.type || 'image',
            url: m.url,
            mime: m.mime || null,
            size: m.size || null,
          })),
        },
      } : {}),
    },
    include: { media: true },
  });
  void recordAnalyticsEvent({
    name: 'ad.update',
    source: 'api',
    userId: req.user.id,
    meta: { adId: updated.id },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  res.json(publicAdView(updated));
});

app.delete('/ads/:id', authRequired, async (req, res) => {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
  if (!ad) return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'admin' && ad.userId !== req.user.id) return res.status(403).json({ error: 'FORBIDDEN' });
  await prisma.ad.update({ where: { id: ad.id }, data: { status: 'DELETED' } });
  res.json({ ok: true });
});

// --------------------
// Boosts (Step 2)
// --------------------
app.get('/ads/:id/boosts', async (req, res) => {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.id }, include: { boosts: true } });
  if (!ad || ad.status === 'DELETED') return res.status(404).json({ error: 'NOT_FOUND' });
  const { active } = computeActiveBoostBadges(ad.boosts);
  res.json({ items: active.map((b) => ({ id: b.id, type: b.type, startAt: b.startAt, endAt: b.endAt })) });
});

app.post('/ads/:id/boost', authRequired, async (req, res) => {
  const { type = 'VIP', durationHours = 24 } = req.body || {};
  const boostType = String(type).toUpperCase();
  const dur = Math.max(parseInt(String(durationHours), 10) || 24, 1);

  const ad = await prisma.ad.findUnique({ where: { id: req.params.id }, include: { boosts: true } });
  if (!ad || ad.status === 'DELETED') return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.user.role !== 'admin' && ad.userId !== req.user.id) return res.status(403).json({ error: 'FORBIDDEN' });

  const actionMap = { VIP: 'BOOST_VIP', URGENT: 'BOOST_URGENT', TOP: 'BOOST_TOP', HOME: 'BOOST_HOME' };
  const action = actionMap[boostType] || 'BOOST_VIP';
  const country = String(ad.country || req.user.country || 'CM').toUpperCase();
  const isPro = await resolveProStatus(req.user);
  const quotaRule = await getQuota({ action, country, categorySlug: ad.categorySlug, role: req.user.role });
  if (!isPro && quotaRule && quotaRule.maxPerDay > 0 && req.user.role === 'user') {
    const countToday = await prisma.adBoost.count({
      where: {
        userId: req.user.id,
        type: boostType,
        createdAt: { gte: startOfTodayISO() },
      },
    });
    if (countToday >= quotaRule.maxPerDay) {
      return res.status(429).json({ error: 'QUOTA_EXCEEDED', maxPerDay: quotaRule.maxPerDay });
    }
  }

  const pricing = await getPricing({ action, country, categorySlug: ad.categorySlug });
  const base = pricing?.creditsCost || 0;
  const mult = dur <= 24 ? 1 : dur <= 72 ? 2 : dur <= 168 ? 4 : Math.ceil(dur / 48);
  const standardCost = base * mult;
  const cost = applyProDiscount(standardCost, isPro);

  const wallet = await ensureWalletForUser(req.user.id);
  if (cost > 0 && wallet.balance < cost) {
    return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', required: cost, balance: wallet.balance });
  }

  const now = new Date();
  const endAt = new Date(now.getTime() + dur * 60 * 60 * 1000);

  const out = await prisma.$transaction(async (tx) => {
    if (cost > 0) {
      await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: cost } } });
      await tx.creditTransaction.create({
        data: {
          userId: req.user.id,
          walletId: wallet.id,
          type: 'DEBIT',
          amount: cost,
          reason: 'AD_BOOST',
          meta: { adId: ad.id, boostType, durationHours: dur, action },
        },
      });
    }

    const createdBoost = await tx.adBoost.create({
      data: {
        adId: ad.id,
        userId: req.user.id,
        type: boostType,
        startAt: now,
        endAt,
      },
    });

    // Keep a persistent badge for UI; active badges are computed from boosts anyway.
    await tx.ad.update({
      where: { id: ad.id },
      data: { badges: { set: Array.from(new Set([...(ad.badges || []), boostType])) } },
    });

    return createdBoost;
  });

  res.status(201).json({ id: out.id, type: out.type, startAt: out.startAt, endAt: out.endAt, costCredits: cost });
});

// Admin: list active boosts
app.get('/admin/boosts/active', authRequired, staffOnly, async (req, res) => {
  const now = new Date();
  const items = await prisma.adBoost.findMany({
    where: { startAt: { lte: now }, endAt: { gt: now } },
    orderBy: { endAt: 'asc' },
    include: { ad: true, user: true },
    take: 200,
  });
  res.json({ items });
});

app.post('/admin/boosts/:id/cancel', authRequired, staffOnly, async (req, res) => {
  const id = req.params.id;
  const now = new Date();
  const item = await prisma.adBoost.update({ where: { id }, data: { endAt: now } });
  res.json({ item });
});

// --------------------
// Chat & Messaging
// --------------------
app.get('/conversations', authRequired, async (req, res) => {
  const archived = String(req.query.archived || '') === '1' || String(req.query.archived || '') === 'true';
  const members = await prisma.conversationMember.findMany({
    where: {
      userId: req.user.id,
      conversation: { adId: { not: null } },
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
    },
    include: {
      conversation: {
        include: {
          ad: { select: { id: true, title: true, city: true, country: true, categorySlug: true } },
          members: { include: { user: { select: { id: true, username: true, city: true, country: true } } } },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { attachments: true, sender: { select: { id: true, username: true } }, reactions: { select: { emoji: true, userId: true } } },
          },
        },
      },
    },
    orderBy: [{ pinnedAt: 'desc' }, { conversation: { lastMessageAt: 'desc' } }],
  });

  const items = await Promise.all(members.map(async (member) => {
    const conv = member.conversation;
    const lastMessage = conv.messages[0] || null;
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conv.id,
        createdAt: { gt: member.lastReadAt || new Date(0) },
        senderId: { not: req.user.id },
      },
    });
    const others = conv.members.filter((m) => m.userId !== req.user.id).map((m) => m.user);
    return {
      id: conv.id,
      adId: conv.adId,
      ad: conv.ad || null,
      lastMessageAt: conv.lastMessageAt,
      lastReadAt: member.lastReadAt,
      mutedUntil: member.mutedUntil,
      pinnedAt: member.pinnedAt,
      archivedAt: member.archivedAt,
      unreadCount,
      members: others,
      lastMessage,
    };
  }));

  res.json({ items });
});

app.post('/conversations/start', authRequired, async (req, res) => {
  const { adId } = req.body || {};
  if (!adId) return res.status(400).json({ error: 'INVALID_INPUT' });
  const ad = await prisma.ad.findUnique({ where: { id: String(adId) } });
  if (!ad) return res.status(404).json({ error: 'AD_NOT_FOUND' });
  const targetUserId = ad.userId;
  if (!targetUserId || targetUserId === req.user.id) return res.status(400).json({ error: 'INVALID_INPUT' });

  const other = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!other) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: req.user.id, blockedId: other.id },
        { blockerId: other.id, blockedId: req.user.id },
      ],
    },
  });
  if (blocked) return res.status(403).json({ error: 'BLOCKED' });

  const existing = await prisma.conversation.findFirst({
    where: {
      adId: ad.id,
      AND: [
        { members: { some: { userId: req.user.id } } },
        { members: { some: { userId: other.id } } },
      ],
    },
    include: {
      ad: { select: { id: true, title: true, city: true, country: true, categorySlug: true } },
      members: { include: { user: { select: { id: true, username: true, city: true, country: true } } } },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { attachments: true, sender: { select: { id: true, username: true } } },
      },
    },
  });
  if (existing) return res.json({ conversation: existing });

  const conversation = await prisma.conversation.create({
    data: {
      adId: ad.id,
      members: {
        create: [{ userId: req.user.id }, { userId: other.id }],
      },
    },
    include: {
      ad: { select: { id: true, title: true, city: true, country: true, categorySlug: true } },
      members: { include: { user: { select: { id: true, username: true, city: true, country: true } } } },
    },
  });

  res.status(201).json({ conversation });
});

app.get('/conversations/:id/messages', authRequired, async (req, res) => {
  const conversationId = req.params.id;
  try {
    await getConversationOrThrow(conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }

  const q = String(req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit || '30', 10) || 30, 100);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const items = await prisma.message.findMany({
    where: {
      conversationId,
      ...(q ? { body: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      attachments: true,
      sender: { select: { id: true, username: true } },
      reads: { select: { userId: true, readAt: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });
  const nextCursor = items.length > limit ? items[limit].id : null;
  const page = items.slice(0, limit).reverse();
  res.json({ items: page, nextCursor });
});

app.post('/conversations/:id/messages', authRequired, async (req, res) => {
  const conversationId = req.params.id;
  try {
    await getConversationOrThrow(conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }

  try {
    const message = await createChatMessage({
      conversationId,
      sender: req.user,
      body: req.body?.body || '',
      attachments: req.body?.attachments || [],
      type: req.body?.type || 'text',
      meta: req.body?.meta || null,
    });
    io.to(roomForConversation(conversationId)).emit('message:new', message);
    res.status(201).json({ message });
  } catch (e) {
    res.status(chatErrorStatus(e.code)).json({ error: e.code || e.message || 'ERROR' });
  }
});

app.post('/conversations/:id/read', authRequired, async (req, res) => {
  const conversationId = req.params.id;
  try {
    await getConversationOrThrow(conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }
  const messageId = req.body?.messageId ? String(req.body.messageId) : null;
  const readAt = await markConversationRead({ conversationId, userId: req.user.id, messageId });
  io.to(roomForConversation(conversationId)).emit('message:read', { conversationId, userId: req.user.id, messageId, readAt });
  res.json({ ok: true, readAt });
});

app.post('/conversations/:id/mute', authRequired, async (req, res) => {
  const conversationId = req.params.id;
  try {
    await getConversationOrThrow(conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }
  const { mute = true, durationMinutes = 0 } = req.body || {};
  const mutedUntil = mute && durationMinutes > 0 ? new Date(Date.now() + durationMinutes * 60 * 1000) : (mute ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null);
  const member = await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: req.user.id } },
    data: { mutedUntil },
  });
  res.json({ mutedUntil: member.mutedUntil });
});

app.post('/conversations/:id/archive', authRequired, async (req, res) => {
  const conversationId = req.params.id;
  try {
    await getConversationOrThrow(conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }
  const { archive = true } = req.body || {};
  const archivedAt = archive ? new Date() : null;
  const member = await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: req.user.id } },
    data: { archivedAt },
  });
  res.json({ archivedAt: member.archivedAt });
});

app.post('/conversations/:id/pin', authRequired, async (req, res) => {
  const conversationId = req.params.id;
  try {
    await getConversationOrThrow(conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }
  const { pin = true } = req.body || {};
  const pinnedAt = pin ? new Date() : null;
  const member = await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: req.user.id } },
    data: { pinnedAt },
  });
  res.json({ pinnedAt: member.pinnedAt });
});

app.post('/messages/:id/reactions', authRequired, async (req, res) => {
  const messageId = req.params.id;
  const emoji = String(req.body?.emoji || '').trim();
  if (!emoji || emoji.length > 20) return res.status(400).json({ error: 'INVALID_INPUT' });
  const message = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true, conversationId: true } });
  if (!message) return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    await getConversationOrThrow(message.conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId: message.id, userId: req.user.id, emoji } },
  });

  let action = 'added';
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
    action = 'removed';
  } else {
    await prisma.messageReaction.create({
      data: { messageId: message.id, userId: req.user.id, emoji },
    });
  }

  io.to(roomForConversation(message.conversationId)).emit('message:reaction', {
    messageId: message.id,
    emoji,
    userId: req.user.id,
    action,
  });

  res.json({ action, emoji, messageId: message.id });
});

app.get('/chat/blocks', authRequired, async (req, res) => {
  const items = await prisma.userBlock.findMany({
    where: { blockerId: req.user.id },
    include: { blocked: { select: { id: true, username: true, city: true, country: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

app.post('/chat/block', authRequired, async (req, res) => {
  const { userId, reason } = req.body || {};
  if (!userId || userId === req.user.id) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: String(userId) } },
    update: { reason: reason || null },
    create: { blockerId: req.user.id, blockedId: String(userId), reason: reason || null },
  });
  res.status(201).json({ item });
});

app.delete('/chat/block/:userId', authRequired, async (req, res) => {
  await prisma.userBlock.deleteMany({
    where: { blockerId: req.user.id, blockedId: String(req.params.userId) },
  });
  res.json({ ok: true });
});

app.post('/chat/report', authRequired, async (req, res) => {
  const { messageId, reason } = req.body || {};
  if (!messageId) return res.status(400).json({ error: 'INVALID_INPUT' });
  const message = await prisma.message.findUnique({ where: { id: String(messageId) } });
  if (!message) return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    await getConversationOrThrow(message.conversationId, req.user.id);
  } catch (e) {
    return res.status(chatErrorStatus(e.code)).json({ error: e.code || 'FORBIDDEN' });
  }

  const report = await prisma.chatReport.create({
    data: { messageId: message.id, reporterId: req.user.id, reason: reason || null },
  });
  await prisma.message.update({ where: { id: message.id }, data: { flagged: true, status: 'FLAGGED' } });
  res.status(201).json({ report });
});

app.get('/admin/chat/flags', authRequired, staffOnly, async (_req, res) => {
  const items = await prisma.message.findMany({
    where: { flagged: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      sender: { select: { id: true, username: true } },
      conversation: { select: { id: true, adId: true } },
      attachments: true,
      reactions: { select: { emoji: true, userId: true } },
    },
  });
  res.json({ items });
});

app.get('/admin/chat/reports', authRequired, staffOnly, async (_req, res) => {
  const items = await prisma.chatReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      reporter: { select: { id: true, username: true } },
      message: {
        include: {
          sender: { select: { id: true, username: true } },
          conversation: { select: { id: true, adId: true } },
          attachments: true,
          reactions: { select: { emoji: true, userId: true } },
        },
      },
    },
  });
  res.json({ items });
});

// --------------------
// Reports
// --------------------
app.post('/reports', async (req, res) => {
  const { adId, type, message = '' } = req.body || {};
  if (!adId || !type) return res.status(400).json({ error: 'INVALID_INPUT' });
  const rep = await prisma.report.create({ data: { adId, type, message } });
  const typeStr = String(type).toLowerCase();
  if (typeStr.includes('fraud') || typeStr.includes('scam') || typeStr.includes('arnaque')) {
    await createAdminAlert({
      type: 'FRAUD',
      severity: 'high',
      title: 'Signalement fraude',
      message: message || `Signalement: ${type}`,
      adId,
      meta: { reportId: rep.id, reportType: type },
    }).catch(() => {});
  }
  void emitAdminKpis().catch(() => {});
  res.status(201).json({ id: rep.id });
});

app.get('/admin/reports', authRequired, adminOnly, async (_req, res) => {
  const items = await prisma.report.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

// --------------------
// Admin: KPIs + Alerts + Support + Audit + RBAC
// --------------------
app.get('/admin/kpi', authRequired, adminOnly, async (_req, res) => {
  const kpis = await computeAdminKpis();
  res.json({ kpis });
});

app.get('/admin/analytics/summary', authRequired, staffOnly, async (req, res) => {
  const { from, to, name, source } = req.query;
  const toDate = to ? new Date(String(to)) : new Date();
  const fromDate = from ? new Date(String(from)) : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'INVALID_DATE' });
  }
  const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  if (ANALYTICS_MAX_RANGE_DAYS && rangeDays > ANALYTICS_MAX_RANGE_DAYS) {
    return res.status(400).json({ error: 'DATE_RANGE_TOO_LARGE', maxDays: ANALYTICS_MAX_RANGE_DAYS });
  }
  const where = {
    createdAt: { gte: fromDate, lte: toDate },
    ...(name ? { name: String(name) } : {}),
    ...(source ? { source: String(source) } : {}),
  };
  const [total, grouped, uniqueUsers, uniqueAnon, activeNowRows] = await prisma.$transaction([
    prisma.analyticsEvent.count({ where }),
    prisma.analyticsEvent.groupBy({
      by: ['name'],
      where,
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
      take: 50,
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, anonymousId: { not: null } },
      select: { anonymousId: true },
      distinct: ['anonymousId'],
    }),
    prisma.userDevice.findMany({
      where: {
        lastSeen: { gte: new Date(Date.now() - ANALYTICS_ACTIVE_WINDOW_MIN * 60 * 1000) },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);
  res.json({
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    total,
    activeUsers: uniqueUsers.filter((row) => row.userId).length,
    activeAnonymous: uniqueAnon.filter((row) => row.anonymousId).length,
    activeNow: activeNowRows.filter((row) => row.userId).length,
    items: grouped.map((row) => ({ name: row.name, count: row._count.name })),
  });
});

app.get('/admin/analytics/events', authRequired, staffOnly, async (req, res) => {
  const { name, source, take = '50', cursor, from, to } = req.query;
  const limit = Math.min(parseInt(String(take), 10) || 50, 100);
  const toDate = to ? new Date(String(to)) : null;
  const fromDate = from ? new Date(String(from)) : null;
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return res.status(400).json({ error: 'INVALID_DATE' });
  }
  const where = {
    ...(name ? { name: String(name) } : {}),
    ...(source ? { source: String(source) } : {}),
    ...(fromDate && toDate ? { createdAt: { gte: fromDate, lte: toDate } } : {}),
    ...(fromDate && !toDate ? { createdAt: { gte: fromDate } } : {}),
    ...(toDate && !fromDate ? { createdAt: { lte: toDate } } : {}),
  };
  const items = await prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
    include: { user: { select: { id: true, username: true } } },
  });
  const nextCursor = items.length > limit ? items[limit].id : null;
  res.json({ items: items.slice(0, limit), nextCursor });
});

app.get('/admin/analytics/timeseries', authRequired, staffOnly, async (req, res) => {
  const { from, to, name, source, bucket = 'day' } = req.query;
  const toDate = to ? new Date(String(to)) : new Date();
  const fromDate = from ? new Date(String(from)) : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'INVALID_DATE' });
  }
  const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  if (ANALYTICS_MAX_RANGE_DAYS && rangeDays > ANALYTICS_MAX_RANGE_DAYS) {
    return res.status(400).json({ error: 'DATE_RANGE_TOO_LARGE', maxDays: ANALYTICS_MAX_RANGE_DAYS });
  }
  const bucketMode = String(bucket).toLowerCase() === 'hour' ? 'hour' : 'day';
  const where = {
    createdAt: { gte: fromDate, lte: toDate },
    ...(name ? { name: String(name) } : {}),
    ...(source ? { source: String(source) } : {}),
  };
  const rows = await prisma.analyticsEvent.findMany({
    where,
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const stepMs = bucketMode === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const start = new Date(fromDate);
  if (bucketMode === 'hour') {
    start.setUTCMinutes(0, 0, 0);
  } else {
    start.setUTCHours(0, 0, 0, 0);
  }
  const end = new Date(toDate);
  if (bucketMode === 'hour') {
    end.setUTCMinutes(0, 0, 0);
  } else {
    end.setUTCHours(0, 0, 0, 0);
  }
  const counts = new Map();
  rows.forEach((row) => {
    const date = new Date(row.createdAt);
    if (bucketMode === 'hour') date.setUTCMinutes(0, 0, 0);
    else date.setUTCHours(0, 0, 0, 0);
    const key = date.toISOString();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const items = [];
  for (let ts = start.getTime(); ts <= end.getTime(); ts += stepMs) {
    const key = new Date(ts).toISOString();
    items.push({ bucket: key, count: counts.get(key) || 0 });
  }
  res.json({ from: start.toISOString(), to: end.toISOString(), bucket: bucketMode, items });
});

app.get('/admin/alerts', authRequired, adminOnly, async (req, res) => {
  const { status, type, take = '50', cursor } = req.query;
  const limit = Math.min(parseInt(String(take), 10) || 50, 100);
  const where = {
    ...(status ? { status: String(status) } : {}),
    ...(type ? { type: String(type) } : {}),
  };
  const items = await prisma.adminAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
    include: { user: { select: { id: true, username: true, email: true } } },
  });
  const nextCursor = items.length > limit ? items[limit].id : null;
  res.json({ items: items.slice(0, limit), nextCursor });
});

app.post('/admin/alerts', authRequired, adminOnly, async (req, res) => {
  const { type, title, message, severity, userId, paymentIntentId, adId, meta } = req.body || {};
  if (!type || !title) return res.status(400).json({ error: 'INVALID_INPUT' });
  const alert = await createAdminAlert({
    type,
    severity,
    title,
    message,
    userId,
    paymentIntentId,
    adId,
    meta,
  });
  await logAdminAction(req, { action: 'alert.create', entityType: 'AdminAlert', entityId: alert.id, meta: { type } });
  res.status(201).json({ item: alert });
});

app.post('/admin/alerts/:id/ack', authRequired, adminOnly, async (req, res) => {
  const alert = await prisma.adminAlert.update({
    where: { id: req.params.id },
    data: { status: 'ACK' },
  });
  await logAdminAction(req, { action: 'alert.ack', entityType: 'AdminAlert', entityId: alert.id });
  void emitAdminKpis().catch(() => {});
  res.json({ item: alert });
});

app.post('/admin/alerts/:id/resolve', authRequired, adminOnly, async (req, res) => {
  const { note } = req.body || {};
  const alert = await prisma.adminAlert.update({
    where: { id: req.params.id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedById: req.user.id,
      meta: note ? { ...(req.body?.meta || {}), note } : req.body?.meta || undefined,
    },
  });
  await logAdminAction(req, { action: 'alert.resolve', entityType: 'AdminAlert', entityId: alert.id, meta: { note } });
  void emitAdminKpis().catch(() => {});
  res.json({ item: alert });
});

// User support (tickets)
app.get('/support/tickets', authRequired, async (req, res) => {
  const items = await prisma.supportTicket.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ items });
});

app.post('/support/tickets', authRequired, async (req, res) => {
  const { subject, message, priority } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: 'INVALID_INPUT' });
  const forbiddenHits = Array.from(new Set([
    ...findForbiddenWords(subject),
    ...findForbiddenWords(message),
  ]));
  if (forbiddenHits.length) {
    if (req.user.role === 'user') {
      await recordForbiddenStrike(req.user.id, { source: 'support.ticket', words: forbiddenHits });
    }
    return res.status(403).json({ error: 'FORBIDDEN_WORDS', details: { words: forbiddenHits } });
  }
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user.id,
      subject: String(subject).slice(0, 200),
      priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(priority)) ? priority : 'MEDIUM',
      lastMessageAt: new Date(),
      messages: {
        create: { senderId: req.user.id, body: String(message).slice(0, 5000) },
      },
    },
    include: { messages: true },
  });
  void emitAdminKpis().catch(() => {});
  res.status(201).json({ item: ticket });
});

app.get('/support/tickets/:id', authRequired, async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } } },
  });
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ item: ticket });
});

app.post('/support/tickets/:id/messages', authRequired, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'INVALID_INPUT' });
  const forbiddenHits = findForbiddenWords(message);
  if (forbiddenHits.length) {
    if (req.user.role === 'user') {
      await recordForbiddenStrike(req.user.id, { source: 'support.message', words: forbiddenHits });
    }
    return res.status(403).json({ error: 'FORBIDDEN_WORDS', details: { words: forbiddenHits } });
  }
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  const msg = await prisma.supportMessage.create({
    data: { ticketId: ticket.id, senderId: req.user.id, body: String(message).slice(0, 5000) },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'PENDING', lastMessageAt: msg.createdAt },
  });
  void emitAdminKpis().catch(() => {});
  res.status(201).json({ item: msg });
});

// Admin support
app.get('/admin/support/tickets', authRequired, adminOnly, async (req, res) => {
  const { status, priority, assignee, take = '50', cursor } = req.query || {};
  const limit = Math.min(parseInt(String(take), 10) || 50, 100);
  const where = {
    ...(status ? { status: String(status) } : {}),
    ...(priority ? { priority: String(priority) } : {}),
    ...(assignee ? { assignedToId: String(assignee) } : {}),
  };
  const items = await prisma.supportTicket.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
    include: { user: { select: { id: true, username: true, email: true } }, assignedTo: { select: { id: true, username: true, email: true } } },
  });
  const nextCursor = items.length > limit ? items[limit].id : null;
  res.json({ items: items.slice(0, limit), nextCursor });
});

app.get('/admin/support/tickets/:id', authRequired, adminOnly, async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, username: true, email: true } },
      assignedTo: { select: { id: true, username: true, email: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, username: true } } } },
    },
  });
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ item: ticket });
});

app.post('/admin/support/tickets/:id/messages', authRequired, adminOnly, async (req, res) => {
  const { message, isInternal } = req.body || {};
  if (!message) return res.status(400).json({ error: 'INVALID_INPUT' });
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });
  const msg = await prisma.supportMessage.create({
    data: { ticketId: ticket.id, senderId: req.user.id, body: String(message).slice(0, 5000), isInternal: Boolean(isInternal) },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: ticket.status === 'CLOSED' ? 'CLOSED' : 'OPEN', lastMessageAt: msg.createdAt },
  });
  await logAdminAction(req, { action: 'support.reply', entityType: 'SupportTicket', entityId: ticket.id, meta: { isInternal } });
  void emitAdminKpis().catch(() => {});
  res.status(201).json({ item: msg });
});

app.post('/admin/support/tickets/:id/assign', authRequired, adminOnly, async (req, res) => {
  const { assigneeId } = req.body || {};
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { assignedToId: assigneeId || null },
  });
  await logAdminAction(req, { action: 'support.assign', entityType: 'SupportTicket', entityId: ticket.id, meta: { assigneeId: assigneeId || null } });
  res.json({ item: ticket });
});

app.post('/admin/support/tickets/:id/status', authRequired, adminOnly, async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'INVALID_INPUT' });
  const ticket = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: {
      status: String(status),
      closedAt: String(status) === 'CLOSED' ? new Date() : null,
    },
  });
  await logAdminAction(req, { action: 'support.status', entityType: 'SupportTicket', entityId: ticket.id, meta: { status } });
  void emitAdminKpis().catch(() => {});
  res.json({ item: ticket });
});

app.get('/admin/audit-logs', authRequired, adminOnly, async (req, res) => {
  const { take = '50', cursor, action, actorId } = req.query || {};
  const limit = Math.min(parseInt(String(take), 10) || 50, 200);
  const where = {
    ...(action ? { action: String(action) } : {}),
    ...(actorId ? { actorId: String(actorId) } : {}),
  };
  const items = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
    include: { actor: { select: { id: true, username: true, email: true } } },
  });
  const nextCursor = items.length > limit ? items[limit].id : null;
  res.json({ items: items.slice(0, limit), nextCursor });
});

// RBAC
app.get('/admin/rbac/roles', authRequired, adminOnly, async (_req, res) => {
  const items = await prisma.adminRole.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
  res.json({ items });
});

app.post('/admin/rbac/roles', authRequired, adminOnly, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'INVALID_INPUT' });
  const role = await prisma.adminRole.create({ data: { name: String(name), description: description || null } });
  await logAdminAction(req, { action: 'rbac.role.create', entityType: 'AdminRole', entityId: role.id });
  res.status(201).json({ item: role });
});

app.put('/admin/rbac/roles/:id', authRequired, adminOnly, async (req, res) => {
  const { name, description } = req.body || {};
  const role = await prisma.adminRole.update({
    where: { id: req.params.id },
    data: { ...(name ? { name: String(name) } : {}), description: description ?? undefined },
  });
  await logAdminAction(req, { action: 'rbac.role.update', entityType: 'AdminRole', entityId: role.id });
  res.json({ item: role });
});

app.delete('/admin/rbac/roles/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.adminRolePermission.deleteMany({ where: { roleId: req.params.id } });
  await prisma.adminUserRole.deleteMany({ where: { roleId: req.params.id } });
  await prisma.adminRole.delete({ where: { id: req.params.id } });
  await logAdminAction(req, { action: 'rbac.role.delete', entityType: 'AdminRole', entityId: req.params.id });
  res.json({ ok: true });
});

app.put('/admin/rbac/roles/:id/permissions', authRequired, adminOnly, async (req, res) => {
  const { permissionIds } = req.body || {};
  if (!Array.isArray(permissionIds)) return res.status(400).json({ error: 'INVALID_INPUT' });
  await prisma.adminRolePermission.deleteMany({ where: { roleId: req.params.id } });
  if (permissionIds.length) {
    await prisma.adminRolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: req.params.id, permissionId })),
      skipDuplicates: true,
    });
  }
  await logAdminAction(req, { action: 'rbac.role.permissions', entityType: 'AdminRole', entityId: req.params.id, meta: { permissionIds } });
  res.json({ ok: true });
});

app.get('/admin/rbac/permissions', authRequired, adminOnly, async (_req, res) => {
  const items = await prisma.adminPermission.findMany({ orderBy: { key: 'asc' } });
  res.json({ items });
});

app.post('/admin/rbac/permissions', authRequired, adminOnly, async (req, res) => {
  const { key, description } = req.body || {};
  if (!key) return res.status(400).json({ error: 'INVALID_INPUT' });
  const perm = await prisma.adminPermission.create({ data: { key: String(key), description: description || null } });
  await logAdminAction(req, { action: 'rbac.permission.create', entityType: 'AdminPermission', entityId: perm.id });
  res.status(201).json({ item: perm });
});

app.put('/admin/rbac/users/:userId/roles', authRequired, adminOnly, async (req, res) => {
  const { roleIds } = req.body || {};
  if (!Array.isArray(roleIds)) return res.status(400).json({ error: 'INVALID_INPUT' });
  await prisma.adminUserRole.deleteMany({ where: { userId: req.params.userId } });
  if (roleIds.length) {
    await prisma.adminUserRole.createMany({
      data: roleIds.map((roleId) => ({ userId: req.params.userId, roleId })),
      skipDuplicates: true,
    });
  }
  await logAdminAction(req, { action: 'rbac.user.roles', entityType: 'User', entityId: req.params.userId, meta: { roleIds } });
  res.json({ ok: true });
});

// --------------------
// Admin moderation
// --------------------
app.get('/admin/ads', authRequired, adminOnly, async (req, res) => {
  const { status, q, country, city, categorySlug, take = '20', cursor } = req.query;
  const limit = Math.min(parseInt(String(take), 10) || 20, 50);
  const where = {
    ...(status ? { status: String(status) } : {}),
    ...(country ? { country: String(country) } : {}),
    ...(city ? { city: String(city) } : {}),
    ...(categorySlug ? { categorySlug: String(categorySlug) } : {}),
    ...(q ? {
      OR: [{ title: { contains: String(q), mode: 'insensitive' } }, { description: { contains: String(q), mode: 'insensitive' } }],
    } : {}),
  };

  const items = await prisma.ad.findMany({
    where,
    include: { media: true },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
  });

  const nextCursor = items.length > limit ? items[limit].id : null;
  res.json({ items: items.slice(0, limit).map(publicAdView), nextCursor });
});

app.get('/admin/ads/:id', authRequired, adminOnly, async (req, res) => {
  const ad = await prisma.ad.findUnique({
    where: { id: req.params.id },
    include: {
      media: true,
      boosts: true,
      user: true,
      reports: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!ad) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({
    item: publicAdView(ad),
    user: ad.user ? {
      id: ad.user.id,
      username: ad.user.username,
      email: ad.user.email,
      phone: ad.user.phone,
      city: ad.user.city,
      country: ad.user.country,
      role: ad.user.role,
    } : null,
    reports: ad.reports || [],
  });
});

app.post('/admin/ads/:id/approve', authRequired, adminOnly, async (req, res) => {
  const updated = await prisma.ad.update({
    where: { id: req.params.id },
    data: { status: 'PUBLISHED', moderation: { state: 'APPROVED', reason: null, reviewedAt: new Date().toISOString(), reviewedBy: req.user.id } },
    include: { media: true },
  });
  await logAdminAction(req, { action: 'ad.approve', entityType: 'Ad', entityId: updated.id });
  void emitAdminKpis().catch(() => {});
  res.json(publicAdView(updated));
});

app.post('/admin/ads/:id/reject', authRequired, adminOnly, async (req, res) => {
  const { reason = 'Non conforme' } = req.body || {};
  const updated = await prisma.ad.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', moderation: { state: 'REJECTED', reason, reviewedAt: new Date().toISOString(), reviewedBy: req.user.id } },
    include: { media: true },
  });
  await logAdminAction(req, { action: 'ad.reject', entityType: 'Ad', entityId: updated.id, meta: { reason } });
  void emitAdminKpis().catch(() => {});
  res.json(publicAdView(updated));
});

app.post('/admin/ads/:id/suspend', authRequired, adminOnly, async (req, res) => {
  const { reason = 'Suspendue' } = req.body || {};
  const updated = await prisma.ad.update({
    where: { id: req.params.id },
    data: { status: 'SUSPENDED', moderation: { state: 'SUSPENDED', reason, reviewedAt: new Date().toISOString(), reviewedBy: req.user.id } },
    include: { media: true },
  });
  await logAdminAction(req, { action: 'ad.suspend', entityType: 'Ad', entityId: updated.id, meta: { reason } });
  void emitAdminKpis().catch(() => {});
  res.json(publicAdView(updated));
});


// --------------------
// Credits (Step 1)
// --------------------

// Public: list available credit packs (optionally filtered by country)
app.get('/credits/packs', async (req, res) => {
  const country = (req.query.country || '').toString().toUpperCase() || null;
  const packs = await prisma.creditPack.findMany({
    where: country ? { isActive: true, OR: [{ country: null }, { country }] } : { isActive: true },
    orderBy: [{ position: 'asc' }, { credits: 'asc' }],
  });
  res.json({ items: packs });
});

// Auth: wallet + recent transactions
app.get('/credits/wallet', authRequired, async (req, res) => {
  const wallet = await ensureWalletForUser(req.user.id);
  const txs = await prisma.creditTransaction.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  res.json({ wallet, txs });
});

// Auth: purchase a pack (FAKE payment for Step 1)
app.post('/credits/purchase', authRequired, async (req, res) => {
  const { packId } = req.body || {};
  if (!packId) return res.status(400).json({ error: 'INVALID_INPUT' });

  const pack = await prisma.creditPack.findUnique({ where: { id: packId } });
  if (!pack || !pack.isActive) return res.status(404).json({ error: 'NOT_FOUND' });

  const wallet = await ensureWalletForUser(req.user.id);

  const updatedWallet = await prisma.$transaction(async (tx) => {
    const w = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: pack.credits } },
    });

    await tx.creditTransaction.create({
      data: {
        userId: req.user.id,
        walletId: wallet.id,
        type: 'CREDIT',
        amount: pack.credits,
        reason: 'PACK_PURCHASE',
        meta: { packId: pack.id, packName: pack.name, price: pack.price, currency: pack.currency },
      },
    });

    return w;
  });

  res.status(201).json({ wallet: updatedWallet });
});

// Admin: adjust credits for a user
app.post('/admin/users/:userId/credits/adjust', authRequired, adminOnly, async (req, res) => {
  const userId = req.params.userId;
  const { amount, reason = 'ADMIN_ADJUST' } = req.body || {};
  if (!Number.isInteger(amount) || amount === 0) return res.status(400).json({ error: 'INVALID_INPUT' });

  const wallet = await ensureWalletForUser(userId);

  const updatedWallet = await prisma.$transaction(async (tx) => {
    const w = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: amount > 0 ? 'CREDIT' : 'DEBIT',
        amount: Math.abs(amount),
        reason,
        meta: { by: req.user.id },
      },
    });

    return w;
  });

  await logAdminAction(req, { action: 'credits.adjust', entityType: 'User', entityId: userId, meta: { amount, reason } });
  res.json({ wallet: updatedWallet });
});

// --------------------
// PRO Subscriptions (Step 3)
// --------------------

app.get('/pro/offers', async (req, res) => {
  const country = (req.query.country || '').toString().toUpperCase() || null;
  const items = await prisma.proOffer.findMany({
    where: { isActive: true, ...(country ? { OR: [{ country: null }, { country }] } : {}) },
    orderBy: [{ position: 'asc' }, { durationDays: 'asc' }],
  });
  const withPrice = items.map((offer) => ({
    ...offer,
    price: offer.creditsCost * CREDIT_VALUE_XAF,
  }));
  res.json({ items: withPrice });
});

app.get('/pro/me', authRequired, async (req, res) => {
  const active = await getActiveSubscription(req.user.id);
  res.json({
    isPro: Boolean(active),
    active: active ? { id: active.id, plan: active.plan, startAt: active.startAt, endAt: active.endAt, status: active.status } : null,
  });
});

app.post('/pro/subscribe', authRequired, async (req, res) => {
  const { plan } = req.body || {};
  const P = String(plan || '').toUpperCase();
  if (!['MONTHLY', 'YEARLY'].includes(P)) return res.status(400).json({ error: 'INVALID_INPUT' });

  const country = String(req.user.country || 'CM').toUpperCase();
  const offer = await prisma.proOffer.findFirst({
    where: { isActive: true, plan: P, OR: [{ country: null }, { country }] },
    orderBy: [{ position: 'asc' }],
  });
  if (!offer) return res.status(404).json({ error: 'NOT_FOUND' });

  const wallet = await ensureWalletForUser(req.user.id);
  if (wallet.balance < offer.creditsCost) {
    return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', required: offer.creditsCost, balance: wallet.balance });
  }

  const now = new Date();
  const endAt = new Date(now.getTime() + offer.durationDays * 24 * 60 * 60 * 1000);

  const sub = await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({ where: { userId: req.user.id, status: 'ACTIVE', endAt: { gt: now } }, data: { status: 'CANCELLED' } });
    await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: offer.creditsCost } } });
    await tx.creditTransaction.create({
      data: {
        userId: req.user.id,
        walletId: wallet.id,
        type: 'DEBIT',
        amount: offer.creditsCost,
        reason: 'PRO_SUBSCRIBE',
        meta: { plan: offer.plan, offerId: offer.id, durationDays: offer.durationDays },
      },
    });
    return tx.subscription.create({
      data: {
        userId: req.user.id,
        plan: offer.plan,
        startAt: now,
        endAt,
        status: 'ACTIVE',
        meta: { offerId: offer.id, name: offer.name, creditsCost: offer.creditsCost },
      },
    });
  });

  res.status(201).json({ subscription: { id: sub.id, plan: sub.plan, startAt: sub.startAt, endAt: sub.endAt, status: sub.status } });
});

// Admin: list subscriptions
app.get('/admin/subscriptions', authRequired, adminOnly, async (_req, res) => {
  const items = await prisma.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { id: true, username: true, email: true, country: true, city: true, role: true } } },
  });
  res.json({ items });
});

app.post('/admin/subscriptions/:id/cancel', authRequired, adminOnly, async (req, res) => {
  const now = new Date();
  const item = await prisma.subscription.update({ where: { id: req.params.id }, data: { status: 'CANCELLED', endAt: now } });
  res.json({ item });
});

// Admin: PRO offers CRUD
app.get('/admin/pro-offers', authRequired, adminOnly, async (req, res) => {
  const { country } = req.query;
  const items = await prisma.proOffer.findMany({
    where: country ? { country: String(country).toUpperCase() } : undefined,
    orderBy: [{ position: 'asc' }, { durationDays: 'asc' }],
  });
  res.json({ items });
});

app.post('/admin/pro-offers', authRequired, adminOnly, async (req, res) => {
  const { plan, name, creditsCost, durationDays, country = null, currency = 'XAF', isActive = true, position = 0 } = req.body || {};
  if (!plan || !name || !Number.isInteger(creditsCost) || !Number.isInteger(durationDays)) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.proOffer.create({ data: { plan, name, creditsCost, durationDays, country, currency, isActive, position } });
  res.status(201).json({ item });
});

app.put('/admin/pro-offers/:id', authRequired, adminOnly, async (req, res) => {
  const item = await prisma.proOffer.update({ where: { id: req.params.id }, data: req.body || {} });
  res.json({ item });
});

app.delete('/admin/pro-offers/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.proOffer.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// --------------------
// Admin: Monetization (Step 1.2)
// --------------------

// Credit packs CRUD
app.get('/admin/credit-packs', authRequired, adminOnly, async (req, res) => {
  const { country } = req.query;
  const items = await prisma.creditPack.findMany({
    where: country ? { country: String(country).toUpperCase() } : undefined,
    orderBy: [{ position: 'asc' }, { credits: 'asc' }],
  });
  res.json({ items });
});

app.post('/admin/credit-packs', authRequired, adminOnly, async (req, res) => {
  const { name, credits, price, currency = 'XAF', country = null, position = 0, isActive = true } = req.body || {};
  if (!name || !Number.isInteger(credits) || !Number.isInteger(price)) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.creditPack.create({ data: { name, credits, price, currency, country, position, isActive } });
  res.status(201).json({ item });
});

app.put('/admin/credit-packs/:id', authRequired, adminOnly, async (req, res) => {
  const item = await prisma.creditPack.update({ where: { id: req.params.id }, data: req.body || {} });
  res.json({ item });
});

app.delete('/admin/credit-packs/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.creditPack.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Pricing rules CRUD
app.get('/admin/pricing-rules', authRequired, adminOnly, async (req, res) => {
  const items = await prisma.pricingRule.findMany({ orderBy: [{ action: 'asc' }, { priority: 'desc' }] });
  res.json({ items });
});

app.post('/admin/pricing-rules', authRequired, adminOnly, async (req, res) => {
  const { action, creditsCost, currency = 'XAF', country = null, categorySlug = null, priority = 0, isActive = true } = req.body || {};
  if (!action || !Number.isInteger(creditsCost)) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.pricingRule.create({ data: { action, creditsCost, currency, country, categorySlug, priority, isActive } });
  res.status(201).json({ item });
});

app.put('/admin/pricing-rules/:id', authRequired, adminOnly, async (req, res) => {
  const item = await prisma.pricingRule.update({ where: { id: req.params.id }, data: req.body || {} });
  res.json({ item });
});

app.delete('/admin/pricing-rules/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.pricingRule.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Quota rules CRUD
app.get('/admin/quota-rules', authRequired, adminOnly, async (req, res) => {
  const items = await prisma.quotaRule.findMany({ orderBy: [{ action: 'asc' }, { priority: 'desc' }] });
  res.json({ items });
});

app.post('/admin/quota-rules', authRequired, adminOnly, async (req, res) => {
  const { action, maxPerDay, country = null, categorySlug = null, role = null, priority = 0, isActive = true } = req.body || {};
  if (!action || !Number.isInteger(maxPerDay)) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.quotaRule.create({ data: { action, maxPerDay, country, categorySlug, role, priority, isActive } });
  res.status(201).json({ item });
});

app.put('/admin/quota-rules/:id', authRequired, adminOnly, async (req, res) => {
  const item = await prisma.quotaRule.update({ where: { id: req.params.id }, data: req.body || {} });
  res.json({ item });
});

app.delete('/admin/quota-rules/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.quotaRule.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});




// =========================================================
// Step 4.6 — Media: S3 presigned upload + confirm
// =========================================================
app.post('/media/presign', authRequired, async (req, res) => {
  if (!s3) return res.status(400).json({ error: 'S3_NOT_CONFIGURED' });
  const { fileName, mime, size } = req.body || {};
  if (!fileName || !mime || !size) return res.status(400).json({ error: 'INVALID_INPUT' });

  const maxMb = parseInt(process.env.MEDIA_MAX_MB || '25', 10) || 25;
  const allowed = String(process.env.MEDIA_ALLOWED_MIME || 'image/jpeg,image/png,image/webp,video/mp4')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!allowed.includes(mime)) return res.status(400).json({ error: 'MIME_NOT_ALLOWED' });
  if (Number(size) > maxMb * 1024 * 1024) return res.status(400).json({ error: 'FILE_TOO_LARGE' });

  const ext = String(fileName).split('.').pop() || 'bin';
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${req.user.id}/${crypto.randomUUID()}.${ext}`;

  const cmd = new PutObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key, ContentType: mime });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  const fileUrl = `${AWS_S3_PUBLIC_BASE_URL}/${key}`;

  const media = await prisma.media.create({
    data: {
      userId: req.user.id,
      type: String(mime).startsWith('video/') ? 'VIDEO' : 'IMAGE',
      mime,
      size: Number(size),
      key,
      originalUrl: fileUrl,
      status: 'UPLOADED',
    },
  });

  res.json({ mediaId: media.id, uploadUrl, fileUrl, key });
});

app.post('/media/confirm', authRequired, async (req, res) => {
  if (!s3) return res.status(400).json({ error: 'S3_NOT_CONFIGURED' });
  const { mediaId } = req.body || {};
  if (!mediaId) return res.status(400).json({ error: 'INVALID_INPUT' });
  const media = await prisma.media.findUnique({ where: { id: String(mediaId) } });
  if (!media || media.userId !== req.user.id) return res.status(404).json({ error: 'MEDIA_NOT_FOUND' });

  await s3.send(new HeadObjectCommand({ Bucket: AWS_S3_BUCKET, Key: media.key }));
  // Note: thumbnails job can be added later; we keep confirm simple for now.
  res.json({ ok: true });
});


// =========================================================
// Step 4.7/4.8 — Admin Security endpoints (Blacklist + Shadowban + Intel)
// =========================================================
app.get('/admin/security/blacklist', authRequired, adminOnly, async (req, res) => {
  const items = await prisma.blacklist.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ items });
});

app.post('/admin/security/blacklist', authRequired, adminOnly, async (req, res) => {
  const { type, value, reason } = req.body || {};
  if (!type || !value) return res.status(400).json({ error: 'INVALID_INPUT' });
  const item = await prisma.blacklist.upsert({
    where: { type_value: { type, value } },
    update: { isActive: true, reason: reason || null },
    create: { type, value, reason: reason || null, isActive: true },
  });
  await logAdminAction(req, { action: 'security.blacklist.upsert', entityType: 'Blacklist', entityId: item.id, meta: { type, value } });
  res.json({ item });
});

app.post('/admin/security/blacklist/:id/toggle', authRequired, adminOnly, async (req, res) => {
  const item = await prisma.blacklist.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  const updated = await prisma.blacklist.update({ where: { id: item.id }, data: { isActive: !item.isActive } });
  await logAdminAction(req, { action: 'security.blacklist.toggle', entityType: 'Blacklist', entityId: updated.id, meta: { isActive: updated.isActive } });
  res.json({ item: updated });
});

app.get('/admin/security-advanced/shadowbans', authRequired, staffOnly, async (req, res) => {
  const items = await prisma.userSecurity.findMany({
    where: { isShadowBanned: true },
    orderBy: { shadowedAt: 'desc' },
    take: 200,
  });
  res.json({ items });
});

app.post('/admin/security-advanced/users/:userId/shadowban', authRequired, staffOnly, async (req, res) => {
  const { userId } = req.params;
  const { isShadowBanned, reason } = req.body || {};
  const item = await prisma.userSecurity.upsert({
    where: { userId },
    update: { isShadowBanned: !!isShadowBanned, shadowReason: reason || null, shadowedAt: isShadowBanned ? new Date() : null },
    create: { userId, isShadowBanned: !!isShadowBanned, shadowReason: reason || null, shadowedAt: isShadowBanned ? new Date() : null },
  });
  await logAdminAction(req, { action: 'security.shadowban', entityType: 'User', entityId: userId, meta: { isShadowBanned: !!isShadowBanned, reason: reason || null } });
  res.json({ item });
});

app.get('/admin/security-advanced/users/:userId/devices', authRequired, staffOnly, async (req, res) => {
  const { userId } = req.params;
  const items = await prisma.userDevice.findMany({ where: { userId }, orderBy: { lastSeen: 'desc' }, take: 200 });
  res.json({ items });
});

app.get('/admin/security-advanced/users/:userId/duplicates', authRequired, staffOnly, async (req, res) => {
  const { userId } = req.params;
  const items = await prisma.adFingerprint.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ items });
});


// =========================================================
// Step 4.9 — Admin Moderation endpoints
// =========================================================
app.get('/admin/moderation/cases', authRequired, staffOnly, async (req, res) => {
  const status = String(req.query.status || 'OPEN');
  const minScore = parseInt(String(req.query.minScore || '0'), 10) || 0;
  const items = await prisma.moderationCase.findMany({
    where: { status, score: { gte: minScore } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: { decisions: true },
  });
  res.json({ items });
});

app.get('/admin/moderation/cases/:id', authRequired, staffOnly, async (req, res) => {
  const item = await prisma.moderationCase.findUnique({ where: { id: req.params.id }, include: { decisions: true } });
  if (!item) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ item });
});

app.post('/admin/moderation/cases/:id/decide', authRequired, staffOnly, async (req, res) => {
  const { action, reason } = req.body || {};
  const mcase = await prisma.moderationCase.findUnique({ where: { id: req.params.id } });
  if (!mcase) return res.status(404).json({ error: 'NOT_FOUND' });

  if (action === 'APPROVE') {
    await prisma.ad.update({ where: { id: mcase.adId }, data: { status: 'PUBLISHED' } });
    await prisma.moderationCase.update({ where: { id: mcase.id }, data: { status: 'CLOSED' } });
  } else if (action === 'REJECT') {
    await prisma.ad.update({ where: { id: mcase.adId }, data: { status: 'REJECTED' } });
    await prisma.moderationCase.update({ where: { id: mcase.id }, data: { status: 'CLOSED' } });
  } else if (action === 'ESCALATE') {
    await prisma.moderationCase.update({ where: { id: mcase.id }, data: { status: 'ESCALATED' } });
  } else {
    return res.status(400).json({ error: 'INVALID_ACTION' });
  }

  const decision = await prisma.moderationDecision.create({
    data: { caseId: mcase.id, staffUserId: req.user.id, action, reason: reason || null },
  });

  res.json({ ok: true, decision });
});

app.use((err, req, res, next) => {
  const status = err?.status || err?.statusCode || 500;
  const code = err?.code || (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
  logger.error({ err, path: req.originalUrl, status, requestId: req.requestId || null }, 'request_exception');
  if (status >= 500) {
    void notifyAlert({
      title: 'request_exception',
      message: err?.message || String(err),
      meta: { path: req.originalUrl, status, code, requestId: req.requestId || null },
    });
  }
  if (res.headersSent) return next(err);
  res.status(status).json({ error: code, details: err?.details || null, requestId: req.requestId || null });
});

// --------------------
// Server
// --------------------
ensureAdminRbacSeed().catch(() => {});
if (ADMIN_KPI_INTERVAL_MS > 0) {
  setInterval(() => {
    void emitAdminKpis().catch(() => {});
  }, ADMIN_KPI_INTERVAL_MS);
}
scheduleDbBackups();
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled_rejection');
  void notifyAlert({ title: 'unhandled_rejection', message: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught_exception');
  void notifyAlert({ title: 'uncaught_exception', message: err?.message || String(err) });
});
server.listen(PORT, () => console.log(`API on :${PORT}`));
