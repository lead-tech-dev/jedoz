import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireStaff } from "../middleware/staff";

export const adminSecurityRouter = Router();

adminSecurityRouter.use(requireStaff);

// Blacklist CRUD (simple)
adminSecurityRouter.get("/blacklist", async (req, res) => {
  const items = await prisma.blacklist.findMany({ orderBy{ createdAt: "desc" }, take: 200 });
  res.json({ items });
});

adminSecurityRouter.post("/blacklist", async (req, res) => {
  const { type, value, reason } = req.body;
  const item = await prisma.blacklist.upsert({
    where{ type_value{ type, value } },
    update{ isActive, reason },
    create{ type, value, reason, isActive: true },
  });
  res.json({ item });
});

adminSecurityRouter.post("/blacklist/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const item = await prisma.blacklist.findUnique({ where{ id } });
  if (!item) return res.status(404).json({ error: "NOT_FOUND" });
  const updated = await prisma.blacklist.update({ where{ id }, data{ isActive: !item.isActive } });
  res.json({ item: updated });
});
