import { Request } from "express";

export function getDeviceId(req){
  const h = (process.env.SECURITY_DEVICE_HEADER || "x-device-id").toLowerCase();
  const v = req.headers[h] | undefined;
  if (!v) return null;
  // basic sanity
  if (v.length < 8 || v.length > 128) return null;
  return v;
}
