import { apiGet, apiPost } from "../lib/api";

export type BlacklistType = "IP" | "PHONE" | "DEVICE";

export type BlacklistItem = {
  id: string;
  type: BlacklistType;
  value: string;
  reason?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type UserSecurity = {
  id: string;
  userId: string;
  isShadowBanned: boolean;
  shadowReason?: string | null;
  shadowedAt?: string | null;
};

export type UserDevice = {
  id: string;
  userId: string;
  deviceId: string;
  firstSeen: string;
  lastSeen: string;
  ipFirst?: string | null;
  ipLast?: string | null;
  userAgent?: string | null;
};

export type AdFingerprint = {
  id: string;
  adId: string;
  userId: string;
  fpText: string;
  createdAt: string;
};

export async function listBlacklist() {
  return apiGet<{ items: BlacklistItem[] }>("/admin/security/blacklist");
}

export async function upsertBlacklist(input: { type: BlacklistType; value: string; reason?: string }) {
  return apiPost<{ item: BlacklistItem }>("/admin/security/blacklist", input);
}

export async function toggleBlacklist(id: string) {
  return apiPost<{ item: BlacklistItem }>(`/admin/security/blacklist/${id}/toggle`, {});
}

export async function listShadowbans() {
  return apiGet<{ items: UserSecurity[] }>("/admin/security-advanced/shadowbans");
}

export async function setShadowban(userId: string, input: { isShadowBanned: boolean; reason?: string }) {
  return apiPost<{ item: UserSecurity }>(`/admin/security-advanced/users/${userId}/shadowban`, input);
}

export async function getUserDevices(userId: string) {
  return apiGet<{ items: UserDevice[] }>(`/admin/security-advanced/users/${userId}/devices`);
}

export async function getUserDuplicates(userId: string) {
  return apiGet<{ items: AdFingerprint[] }>(`/admin/security-advanced/users/${userId}/duplicates`);
}
