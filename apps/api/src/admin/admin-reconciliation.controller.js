import { Router } from "express";

/**
 * Mount under /admin/reconciliation
 * Requires a paymentService.verifyIntent(intentId) that:
 * - for MTN: GET requesttopay/{providerRef}
 * - for ORANGE: GET paymentstatus/{payToken}
 * - for STRIPE: retrieve session/payment_intent or rely on webhook; here we can check session status
 */
export function adminReconciliationRouter(deps{
  prisma: any;
  requireStaff: any;
  paymentService: any;
}) {
  const r = Router();
  r.use(deps.requireStaff);

  // GET /admin/reconciliation/stuck
  r.get("/stuck", async (req, res) => {
    const minAgeMinutes = parseInt((req.query.minAgeMinutes) ?? "10", 10);
    const provider = req.query.provider | undefined;
    const limit = Math.min(parseInt((req.query.limit) ?? "100", 10), 500);

    const threshold = new Date(Date.now() - minAgeMinutes * 60_000);
    const where= {
      status{ in: ["PENDING", "INITIATED"] },
      createdAt{ lt: threshold },
    };
    if (provider) where.provider = provider;

    const items = await deps.prisma.paymentIntent.findMany({
      where,
      orderBy{ createdAt: "asc" },
      take,
    });

    res.json({ items, threshold });
  });

  // POST /admin/reconciliation/:id/reverify
  r.post("/:id/reverify", async (req, res) => {
    const intent = await deps.prisma.paymentIntent.findUnique({ where{ id: req.params.id } });
    if (!intent) return res.status(404).json({ error: "NOT_FOUND" });

    const result = await deps.paymentService.verifyIntent(intent.id);
    res.json({ intentId: intent.id, ...result });
  });

  // POST /admin/reconciliation/:id/cancel
  r.post("/:id/cancel", async (req, res) => {
    const intent = await deps.prisma.paymentIntent.findUnique({ where{ id: req.params.id } });
    if (!intent) return res.status(404).json({ error: "NOT_FOUND" });

    if (intent.status === "SUCCESS") return res.status(409).json({ error: "CANNOT_CANCEL_SUCCESS" });

    const updated = await deps.prisma.paymentIntent.update({
      where{ id: intent.id },
      data{ status: "CANCELLED" },
    });
    res.json(updated);
  });

  return r;
}
