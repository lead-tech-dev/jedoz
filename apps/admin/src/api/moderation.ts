import { apiGet, apiPost } from "../lib/api";

export type ModerationCaseStatus = "OPEN" | "CLOSED" | "ESCALATED";
export type ModerationAction = "APPROVE" | "REJECT" | "ESCALATE";

export type ModerationCase = {
  id: string;
  adId: string;
  userId: string;
  country?: string | null;
  categorySlug?: string | null;
  score: number;
  status: ModerationCaseStatus;
  reasons: any;
  createdAt: string;
  updatedAt: string;
  decisions?: ModerationDecision[];
};

export type ModerationDecision = {
  id: string;
  caseId: string;
  staffUserId: string;
  action: ModerationAction;
  reason?: string | null;
  createdAt: string;
};

export async function listCases(params: { status?: ModerationCaseStatus; minScore?: number }) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (typeof params.minScore === "number") q.set("minScore", String(params.minScore));
  return apiGet<{ items: ModerationCase[] }>(`/admin/moderation/cases?${q.toString()}`);
}

export async function getCase(id: string) {
  return apiGet<{ item: ModerationCase }>(`/admin/moderation/cases/${id}`);
}

export async function decideCase(id: string, input: { action: ModerationAction; reason?: string }) {
  return apiPost<{ ok: true }>(`/admin/moderation/cases/${id}/decide`, input);
}
