import { Request } from "express";
import { prisma } from "../lib/prisma";

export function getDeviceId(req) {
  const h = (process.env.SECURITY_DEVICE_HEADER || "x-device-id").toLowerCase();
  const v = req.headers[h] | undefined;
  if (!v) return null;
  if (v.length < 8 || v.length > 128) return null;
  return v;
}

/**
 * Call on authenticated requests to keep track of user devices.
 */
export async function linkUserDevice(req) {
  const deviceId = getDeviceId(req);
  if (!deviceId || !req.user?.id) return;

  const ip = req.ip || (req.headers["x-forwarded-for"]) || null;
  const ua = (req.headers["user-agent"]) || null;

  await prisma.userDevice.upsert({
    where{ userId_deviceId{ userId: req.user.id, deviceId } },
    update{ ipLast, userAgent: ua },
    create{ userId: req.user.id, deviceId, ipFirst, ipLast, userAgent: ua },
  });
}
