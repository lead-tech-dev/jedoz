import { prisma } from "../lib/prisma";
import { getDeviceId } from "./device";
import { Request } from "express";

export type BlacklistReason = "IP" | "PHONE" | "DEVICE";

export async function assertNotBlacklisted(req) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const deviceId = getDeviceId(req);
  const phone = (req.body?.phone || req.body?.msisdn || req.body?.payerPhone) | undefined;

  const hits = await prisma.blacklist.findMany({
    where{
      OR: [
        { type: "IP", value: ip },
        ...(deviceId ? [{ type: "DEVICE", value: deviceId }] ),
        ...(phone ? [{ type: "PHONE", value: phone }] ),
      ],
      isActive,
    },
    take,
  });

  if (hits.length) {
    const types = hits.map(h => h.type);
    const reason = hits[0].reason || "BLACKLISTED";
    const err= new Error("BLACKLISTED");
    err.status = 403;
    err.payload = { error: "BLACKLISTED", types, reason };
    throw err;
  }
}
