import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Admin user (set ADMIN_EMAIL / ADMIN_PASSWORD to seed)
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const admin = adminEmail && adminPassword
    ? await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        role: 'admin',
        email: adminEmail,
        passwordHash: bcrypt.hashSync(adminPassword, 10),
        username: 'admin',
        city: 'Douala',
        country: 'CM',
      },
    })
    : null;

  // Moderator user (set MODERATOR_EMAIL / MODERATOR_PASSWORD to seed)
  const modEmail = process.env.MODERATOR_EMAIL || '';
  const modPassword = process.env.MODERATOR_PASSWORD || '';
  const moderator = modEmail && modPassword
    ? await prisma.user.upsert({
      where: { email: modEmail },
      update: {},
      create: {
        role: 'moderator',
        email: modEmail,
        passwordHash: bcrypt.hashSync(modPassword, 10),
        username: 'moderator',
        city: 'Douala',
        country: 'CM',
      },
    })
    : null;

  // Credit wallets
  if (admin) {
    await prisma.creditWallet.upsert({
      where: { userId: admin.id },
      update: {},
      create: { userId: admin.id, balance: 0 },
    });
  }
  if (moderator) {
    await prisma.creditWallet.upsert({
      where: { userId: moderator.id },
      update: {},
      create: { userId: moderator.id, balance: 0 },
    });
  }


  // Categories
  const cats = [
    { slug: 'rencontres', name: 'Rencontres', position: 10 },
    { slug: 'escorts', name: 'Escorts', position: 20 },
    { slug: 'massages', name: 'Massages', position: 30 },
    { slug: 'webcam', name: 'Webcam', position: 40 },
    { slug: 'boutique', name: 'Boutique adulte', position: 50 },
  ];

  for (const c of cats) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, position: c.position },
      create: { ...c },
    });
  }

  // Credit packs (Step 1)
  const packs = [
    { name: 'Nano', credits: 3, price: 1000, currency: 'XAF', country: 'CM', position: 5 },
    { name: 'Starter', credits: 5, price: 2000, currency: 'XAF', country: 'CM', position: 10 },
    { name: 'Mini', credits: 10, price: 3500, currency: 'XAF', country: 'CM', position: 20 },
    { name: 'Booster', credits: 15, price: 5000, currency: 'XAF', country: 'CM', position: 30 },
    { name: 'Plus', credits: 20, price: 6500, currency: 'XAF', country: 'CM', position: 40 },
    { name: 'Power', credits: 25, price: 8000, currency: 'XAF', country: 'CM', position: 50 },
    { name: 'Pro', credits: 40, price: 10000, currency: 'XAF', country: 'CM', position: 60 },
    { name: 'Pro Plus', credits: 50, price: 15000, currency: 'XAF', country: 'CM', position: 70 },
    { name: 'Ultra', credits: 60, price: 18000, currency: 'XAF', country: 'CM', position: 80 },
    { name: 'Mega', credits: 75, price: 22000, currency: 'XAF', country: 'CM', position: 90 },
    { name: 'Mega Plus', credits: 90, price: 26000, currency: 'XAF', country: 'CM', position: 100 },
    { name: 'Max', credits: 110, price: 30000, currency: 'XAF', country: 'CM', position: 110 },
    { name: 'Elite', credits: 130, price: 35000, currency: 'XAF', country: 'CM', position: 120 },
    { name: 'Premium', credits: 160, price: 42000, currency: 'XAF', country: 'CM', position: 130 },
    { name: 'Platinum', credits: 200, price: 50000, currency: 'XAF', country: 'CM', position: 140 },
    { name: 'Diamond', credits: 250, price: 62000, currency: 'XAF', country: 'CM', position: 150 },
    { name: 'Gold', credits: 300, price: 74000, currency: 'XAF', country: 'CM', position: 160 },
    { name: 'Titan', credits: 400, price: 95000, currency: 'XAF', country: 'CM', position: 170 },
    { name: 'Supreme', credits: 500, price: 115000, currency: 'XAF', country: 'CM', position: 180 },
    { name: 'Ultimate', credits: 700, price: 155000, currency: 'XAF', country: 'CM', position: 190 },
  ];
  for (const p of packs) {
    const existingPack = await prisma.creditPack.findFirst({ where: { name: p.name, country: p.country } });
    if (existingPack) {
      await prisma.creditPack.update({ where: { id: existingPack.id }, data: { credits: p.credits, price: p.price, currency: p.currency, position: p.position, isActive: true } });
    } else {
      await prisma.creditPack.create({ data: p });
    }
  }

  // PRO offers (Step 3) — priced in credits for now
  const proOffers = [
    { plan: 'MONTHLY', name: 'PRO Mensuel', creditsCost: 60, durationDays: 30, currency: 'XAF', country: 'CM', position: 10 },
    { plan: 'YEARLY', name: 'PRO Annuel', creditsCost: 600, durationDays: 365, currency: 'XAF', country: 'CM', position: 20 },
  ];
  for (const o of proOffers) {
    const existing = await prisma.proOffer.findFirst({ where: { plan: o.plan, country: o.country } });
    if (existing) {
      await prisma.proOffer.update({ where: { id: existing.id }, data: { name: o.name, creditsCost: o.creditsCost, durationDays: o.durationDays, currency: o.currency, isActive: true, position: o.position } });
    } else {
      await prisma.proOffer.create({ data: o });
    }
  }

  // Pricing rules (Step 1.2)
  // Default: publishing an ad costs credits (can be overridden per category/country)
  const pricing = [
    { action: 'PUBLISH_AD', creditsCost: 5, currency: 'XAF', country: 'CM', categorySlug: null, priority: 10, isActive: true },
    // Example override: escorts cost more
    { action: 'PUBLISH_AD', creditsCost: 8, currency: 'XAF', country: 'CM', categorySlug: 'escorts', priority: 20, isActive: true },

    // Step 2: boosts (base cost for 24h; longer durations are multiplied in API)
    { action: 'BOOST_VIP', creditsCost: 20, currency: 'XAF', country: 'CM', categorySlug: null, priority: 10, isActive: true },
    { action: 'BOOST_URGENT', creditsCost: 15, currency: 'XAF', country: 'CM', categorySlug: null, priority: 10, isActive: true },
    { action: 'BOOST_TOP', creditsCost: 25, currency: 'XAF', country: 'CM', categorySlug: null, priority: 10, isActive: true },
    { action: 'BOOST_HOME', creditsCost: 40, currency: 'XAF', country: 'CM', categorySlug: null, priority: 10, isActive: true },
  ];
  for (const r of pricing) {
    const existingRule = await prisma.pricingRule.findFirst({
      where: { action: r.action, country: r.country, categorySlug: r.categorySlug },
    });
    if (existingRule) {
      await prisma.pricingRule.update({ where: { id: existingRule.id }, data: { creditsCost: r.creditsCost, currency: r.currency, isActive: true, priority: r.priority } });
    } else {
      await prisma.pricingRule.create({ data: r });
    }
  }

  // Quotas (Step 1.2)
  // Default: max X ads/day for regular users
  const quotas = [
    { action: 'PUBLISH_AD', maxPerDay: 3, country: 'CM', categorySlug: null, role: 'user', priority: 10, isActive: true },
    { action: 'BOOST_VIP', maxPerDay: 2, country: 'CM', categorySlug: null, role: 'user', priority: 10, isActive: true },
    { action: 'BOOST_URGENT', maxPerDay: 2, country: 'CM', categorySlug: null, role: 'user', priority: 10, isActive: true },
    { action: 'BOOST_TOP', maxPerDay: 1, country: 'CM', categorySlug: null, role: 'user', priority: 10, isActive: true },
    { action: 'BOOST_HOME', maxPerDay: 1, country: 'CM', categorySlug: null, role: 'user', priority: 10, isActive: true },
    // Staff/admin unlimited (no rule)
  ];
  for (const q of quotas) {
    const existingQuota = await prisma.quotaRule.findFirst({ where: { action: q.action, country: q.country, categorySlug: q.categorySlug, role: q.role } });
    if (existingQuota) {
      await prisma.quotaRule.update({ where: { id: existingQuota.id }, data: { maxPerDay: q.maxPerDay, isActive: true, priority: q.priority } });
    } else {
      await prisma.quotaRule.create({ data: q });
    }
  }


  // Simple dynamic forms example (steps + fields) for rencontres
  const rencontres = await prisma.category.findUnique({ where: { slug: 'rencontres' } });
  if (rencontres) {
    const step = await prisma.formStep.upsert({
      where: { id: `${rencontres.id}::main` },
      update: { label: 'Dites-nous en plus', order: 10 },
      create: {
        id: `${rencontres.id}::main`,
        categoryId: rencontres.id,
        name: 'ad_params',
        label: 'Dites-nous en plus',
        order: 10,
        info: ['Plus vous détaillez, plus vous recevez de contacts.'],
        flow: null,
      },
    });

    const fields = [
      { id: `${step.id}::gender`, name: 'gender', label: 'Genre', type: 'select', values: ['Homme', 'Femme', 'Couple', 'Autre'], rules: { required: true } },
      { id: `${step.id}::age`, name: 'age', label: 'Âge', type: 'number', rules: { required: true, min: 18, max: 99 } },
      { id: `${step.id}::whatsapp`, name: 'whatsapp', label: 'WhatsApp', type: 'text', rules: { required: false } },
    ];

    for (const f of fields) {
      await prisma.formField.upsert({
        where: { id: f.id },
        update: { label: f.label, type: f.type, values: f.values, rules: f.rules },
        create: { ...f, stepId: step.id },
      });
    }
  }

  console.log('Seed done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
