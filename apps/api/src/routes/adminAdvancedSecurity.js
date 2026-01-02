import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireStaff } from "../middleware/staff";

export const adminAdvancedSecurityRouter = Router();
adminAdvancedSecurityRouter.use(requireStaff);

/**
 * Shadow-ban management
 */
adminAdvancedSecurityRouter.get("/shadowbans", async (req, res) => {
  const items = await prisma.userSecurity.findMany({
    where{ isShadowBanned: true },
    orderBy{ shadowedAt: "desc" },
    take,
  });
  res.json({ items });
});

adminAdvancedSecurityRouter.post("/users/:userId/shadowban", async (req, res) => {
  const { userId } = req.params;
  const { isShadowBanned, reason } = req.body as { isShadowBanned: boolean; reason?: string };

  const item = await prisma.userSecurity.upsert({
    where{ userId },
    update{
      isShadowBanned,
      shadowReason,
      shadowedAt: isShadowBanned ? new Date() ,
    },
    create{
      userId,
      isShadowBanned,
      shadowReason,
      shadowedAt: isShadowBanned ? new Date() ,
    },
  });
  res.json({ item });
});

/**
 * Devices by user
 */
adminAdvancedSecurityRouter.get("/users/:userId/devices", async (req, res) => {
  const { userId } = req.params;
  const items = await prisma.userDevice.findMany({
    where{ userId },
    orderBy{ lastSeen: "desc" },
    take,
  });
  res.json({ items });
});

/**
 * Duplicate candidates (by user): show their recent fingerprints
 */
adminAdvancedSecurityRouter.get("/users/:userId/duplicates", async (req, res) => {
  const { userId } = req.params;
  const items = await prisma.adFingerprint.findMany({
    where{ userId },
    orderBy{ createdAt: "desc" },
    take,
  });
  res.json({ items });
});
