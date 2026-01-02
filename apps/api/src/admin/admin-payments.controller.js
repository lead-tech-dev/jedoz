import { Router } from "express";

/**
 * Mount under /admin/payments
 * Assumes you already have:
 * - requireStaff middleware (admin/moderator)
 * - prisma client
 * - paymentService with verifyIntent(intentId)
 */
export function adminPaymentsRouter(deps{
  prisma: any;
  requireStaff: any;
  paymentService: any;
}) {
  const r = Router();
  r.use(deps.requireStaff);

  // GET /admin/payments/intents
  r.get("/intents", async (req, res) => {
    const { provider, status, productType, q, dateFrom, dateTo, cursor, limit } = req.query;
    const take = Math.min(parseInt(limit ?? "50", 10), 200);
    const where= {};
    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (productType) where.productType = productType;
    if (q) {
      where.OR = [
        { id{ contains: q } },
        { userId{ contains: q } },
        { providerRef{ contains: q } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const intents = await deps.prisma.paymentIntent.findMany({
      where,
      orderBy{ createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor{ id: cursor }, skip: 1 } {}),
      include{ user{ select{ email: true } } },
    });

    const hasMore = intents.length > take;
    const items = hasMore ? intents.slice(0, take) : intents;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    res.json({ items, nextCursor });
  });

  // GET /admin/payments/intents/:id
  r.get("/intents/:id", async (req, res) => {
    const intent = await deps.prisma.paymentIntent.findUnique({
      where{ id: req.params.id },
      include{ events, user{ select{ email: true } } },
    });
    if (!intent) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(intent);
  });

  // GET /admin/payments/intents/:id/events
  r.get("/intents/:id/events", async (req, res) => {
    const events = await deps.prisma.paymentEvent.findMany({
      where{ intentId: req.params.id },
      orderBy{ createdAt: "desc" },
      take,
    });
    res.json({ items: events });
  });

  // GET /admin/payments/export.csv
  r.get("/export.csv", async (req, res) => {
    const { provider, status, productType, dateFrom, dateTo } = req.query;
    const where= {};
    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (productType) where.productType = productType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=payment_intents.csv");

    res.write("id,createdAt,provider,status,productType,amount,currency,country,userId,providerRef\n");

    const batch = 1000;
    let cursor= null;

    while (true) {
      const rows = await deps.prisma.paymentIntent.findMany({
        where,
        orderBy{ id: "asc" },
        take,
        ...(cursor ? { cursor{ id: cursor }, skip: 1 } {}),
        select{ id, createdAt, provider, status, productType, amount, currency, country, userId, providerRef: true },
      });
      if (!rows.length) break;
      for (const row of rows) {
        const line = [
          row.id,
          row.createdAt.toISOString(),
          row.provider,
          row.status,
          row.productType,
          row.amount,
          row.currency,
          row.country,
          row.userId,
          row.providerRef ?? ""
        ].map(v => `"${String(v).replaceAll('"', '""')}"`).join(",");
        res.write(line + "\n");
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < batch) break;
    }

    res.end();
  });

  return r;
}
