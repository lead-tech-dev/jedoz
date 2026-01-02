import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireStaff } from "../middleware/staff";

export const adminModerationRouter = Router();
adminModerationRouter.use(requireStaff);

adminModerationRouter.get("/cases", async (req, res) => {
  const status = (req.query.status | undefined) || "OPEN";
  const minScore = Number(req.query.minScore ?? 0);
  const items = await prisma.moderationCase.findMany({
    where{ status, score{ gte: minScore } },
    orderBy{ updatedAt: "desc" },
    take,
    include{ decisions: true },
  });
  res.json({ items });
});

adminModerationRouter.get("/cases/:id", async (req, res) => {
  const item = await prisma.moderationCase.findUnique({
    where{ id: req.params.id },
    include{ decisions: true },
  });
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ item });
});

adminModerationRouter.post("/cases/:id/decide", async (req) => {
  const { action, reason } = req.body as { action: "APPROVE" | "REJECT" | "ESCALATE"; reason?: string };
  const mcase = await prisma.moderationCase.findUnique({ where{ id: req.params.id } });
  if (!mcase) return res.status(404).json({ error: "NOT_FOUND" });

  // Update ad status depending on decision (assumes Ad model with status)
  if (action === "APPROVE") {
    await prisma.ad.update({ where{ id: mcase.adId }, data{ status: "PUBLISHED" } });
    await prisma.moderationCase.update({ where{ id: mcase.id }, data{ status: "CLOSED" } });
  } else if (action === "REJECT") {
    await prisma.ad.update({ where{ id: mcase.adId }, data{ status: "REJECTED" } });
    await prisma.moderationCase.update({ where{ id: mcase.id }, data{ status: "CLOSED" } });
  } else {
    await prisma.moderationCase.update({ where{ id: mcase.id }, data{ status: "ESCALATED" } });
  }

  const decision = await prisma.moderationDecision.create({
    data{
      caseId: mcase.id,
      staffUserId: req.user.id,
      action,
      reason,
    },
  });

  res.json({ ok, decision });
});
