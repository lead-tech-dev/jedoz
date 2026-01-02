import bullmq from 'bullmq';
const { Worker, Queue } = bullmq;
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import pino from 'pino';
import { createRedisConnection, QUEUE_NAMES } from './queue.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const prisma = new PrismaClient();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;

// ---------------------------------
// Jobs
// ---------------------------------
const JOBS = {
  PROCESS_INTENT: 'process_intent',
  VERIFY_PENDING_BATCH: 'verify_pending_batch',
  EXPIRE_INTENTS: 'expire_intents',
  EXPIRE_SUBSCRIPTIONS: 'expire_subscriptions',
};

async function fulfillPaymentIntent(intentId) {
  // Fulfillment rules are intentionally minimal here:
  // - CREDIT_PACK -> credit wallet by pack credits
  // - PRO_SUBSCRIPTION -> create/extend subscription
  // - BOOST -> create boost
  // This worker only triggers fulfillment once intent is SUCCESS.

  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) return;
  if (intent.status !== 'SUCCESS') return;

  // Avoid double fulfillment
  const already = intent.providerData?.fulfilledAt ? true : false;
  if (already) return;

  await prisma.$transaction(async (tx) => {
    // Mark fulfilled early in transaction to prevent races
    await tx.paymentIntent.update({
      where: { id: intentId },
      data: { providerData: { ...(intent.providerData || {}), fulfilledAt: new Date().toISOString() } },
    });

    if (intent.productType === 'CREDIT_PACK') {
      const pack = intent.productRefId
        ? await tx.creditPack.findUnique({ where: { id: intent.productRefId } })
        : null;
      const credits = pack?.credits || intent.providerData?.credits || 0;
      if (credits > 0) {
        const wallet = await tx.creditWallet.upsert({
          where: { userId: intent.userId },
          update: { balance: { increment: credits } },
          create: { userId: intent.userId, balance: credits },
        });
        await tx.creditTransaction.create({
          data: {
            amount: credits,
            type: 'CREDIT',
            reason: 'PACK_PURCHASE',
            meta: { packId: intent.productRefId || null, packName: pack?.name || null, credits },
            user: { connect: { id: intent.userId } },
            wallet: { connect: { id: wallet.id } },
          },
        });
      }
    }

    if (intent.productType === 'PRO_SUBSCRIPTION') {
      const offer = intent.productRefId
        ? await tx.proOffer.findUnique({ where: { id: intent.productRefId } })
        : null;
      const days = offer?.durationDays || intent.providerData?.durationDays || 30;
      const now = new Date();
      const current = await tx.subscription.findFirst({
        where: { userId: intent.userId, status: 'ACTIVE', endAt: { gt: now } },
        orderBy: { endAt: 'desc' },
      });
      const startAt = current ? current.endAt : now;
      const endAt = new Date(startAt.getTime() + days * 24 * 60 * 60 * 1000);
      await tx.subscription.create({
        data: {
          userId: intent.userId,
          plan: offer?.plan || 'MONTHLY',
          startAt,
          endAt,
          status: 'ACTIVE',
        },
      });
    }

    // BOOST is handled elsewhere in the codebase; kept as placeholder.
  });
}

async function verifyIntent(intentId) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) return { ok: false, reason: 'NOT_FOUND' };
  if (intent.status === 'SUCCESS') {
    await fulfillPaymentIntent(intentId);
    return { ok: true, status: intent.status };
  }
  if (['FAILED', 'CANCELLED', 'REFUNDED'].includes(intent.status)) {
    return { ok: true, status: intent.status };
  }

  if (intent.provider === 'STRIPE') {
    if (!stripe || !intent.providerRef) return { ok: false, reason: 'STRIPE_NOT_CONFIGURED' };
    const session = await stripe.checkout.sessions.retrieve(intent.providerRef);
    const paid = session?.payment_status === 'paid';
    if (paid) {
      await prisma.paymentIntent.update({
        where: { id: intentId },
        data: {
          status: 'SUCCESS',
          providerData: { ...(intent.providerData || {}), stripePaymentIntentId: String(session.payment_intent || '') },
        },
      });
      await fulfillPaymentIntent(intentId);
      return { ok: true, status: 'SUCCESS' };
    }
    const expired = session?.status === 'expired';
    if (expired) {
      await prisma.paymentIntent.update({ where: { id: intentId }, data: { status: 'CANCELLED' } });
      return { ok: true, status: 'CANCELLED' };
    }
    return { ok: true, status: intent.status, stripe: { status: session?.status, payment_status: session?.payment_status } };
  }

  // Orange/MTN: keep as no-op in worker (they are handled by polling/webhooks)
  // You can extend this by calling the provider status APIs if you already have them implemented.
  return { ok: true, status: intent.status, message: 'No background verifier configured for this provider yet.' };
}

async function expireOldIntents() {
  const minutes = Math.min(Math.max(parseInt(process.env.PAYMENT_INTENT_TTL_MINUTES || '60', 10) || 60, 5), 24 * 60);
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const res = await prisma.paymentIntent.updateMany({
    where: { status: { in: ['INITIATED', 'PENDING'] }, createdAt: { lt: cutoff } },
    data: { status: 'CANCELLED' },
  });
  return { minutes, cancelled: res.count };
}

async function expireSubscriptions() {
  const now = new Date();
  const res = await prisma.subscription.updateMany({
    where: { status: 'ACTIVE', endAt: { lte: now } },
    data: { status: 'EXPIRED' },
  });
  return { expired: res.count };
}

async function verifyPendingBatch() {
  const olderThanMin = Math.min(Math.max(parseInt(process.env.PAYMENT_VERIFY_AFTER_MINUTES || '2', 10) || 2, 1), 60);
  const newerThanMin = Math.min(Math.max(parseInt(process.env.PAYMENT_VERIFY_BEFORE_MINUTES || '60', 10) || 60, 5), 24 * 60);
  const olderThan = new Date(Date.now() - olderThanMin * 60 * 1000);
  const newerThan = new Date(Date.now() - newerThanMin * 60 * 1000);

  const intents = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['INITIATED', 'PENDING'] },
      createdAt: { lte: olderThan, gte: newerThan },
      provider: { in: ['STRIPE'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const queue = new Queue(QUEUE_NAMES.PAYMENTS, { connection: createRedisConnection() });
  for (const i of intents) {
    await queue.add(JOBS.PROCESS_INTENT, { intentId: i.id }, { jobId: `intent:${i.id}`, removeOnComplete: 200, removeOnFail: 200 });
  }
  await queue.close();
  return { queued: intents.length };
}

async function main() {
  const connection = createRedisConnection();

  const worker = new Worker(
    QUEUE_NAMES.PAYMENTS,
    async (job) => {
      const { name, data } = job;
      if (name === JOBS.PROCESS_INTENT) {
        const out = await verifyIntent(data.intentId);
        return out;
      }
      if (name === JOBS.VERIFY_PENDING_BATCH) {
        return verifyPendingBatch();
      }
      if (name === JOBS.EXPIRE_INTENTS) {
        return expireOldIntents();
      }
      if (name === JOBS.EXPIRE_SUBSCRIPTIONS) {
        return expireSubscriptions();
      }
      return { ok: true, ignored: true };
    },
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10) || 5,
    }
  );

  worker.on('completed', (job, result) => {
    log.info({ jobId: job.id, name: job.name, result }, 'job completed');
  });

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, name: job?.name, err: String(err) }, 'job failed');
  });

  // Register repeatable jobs
  const queue = new Queue(QUEUE_NAMES.PAYMENTS, { connection });
  await queue.add(JOBS.VERIFY_PENDING_BATCH, {}, { repeat: { every: 2 * 60 * 1000 }, jobId: 'repeat:verify_pending_batch' });
  await queue.add(JOBS.EXPIRE_INTENTS, {}, { repeat: { every: 10 * 60 * 1000 }, jobId: 'repeat:expire_intents' });
  await queue.add(JOBS.EXPIRE_SUBSCRIPTIONS, {}, { repeat: { every: 60 * 60 * 1000 }, jobId: 'repeat:expire_subscriptions' });

  log.info({ redis: process.env.REDIS_URL || 'redis://localhost:6379' }, 'worker started');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
