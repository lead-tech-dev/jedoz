import { api } from "./client";

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  country?: string | null;
  isActive: boolean;
};

export type ProOffer = {
  id: string;
  name: string;
  plan: "MONTHLY" | "YEARLY";
  creditsCost: number;
  durationDays: number;
  country?: string | null;
  isActive: boolean;
};

export type BoostConfig = {
  id: string;
  name: string;
  creditsCost: number;
  durationHours: number;
  country?: string | null;
  isActive: boolean;
};

export type CountryPricing = {
  id: string;
  country: string;
  creditValueXaf: number;
  currency: string;
};

// ---- Credit packs ----
export async function listCreditPacks() {
  const { data } = await api.get("/admin/monetization/credit-packs");
  return data as { items: CreditPack[] };
}

export async function upsertCreditPack(input: Partial<CreditPack>) {
  const { data } = await api.post("/admin/monetization/credit-packs", input);
  return data as { item: CreditPack };
}

export async function toggleCreditPack(id: string) {
  const { data } = await api.post(`/admin/monetization/credit-packs/${id}/toggle`);
  return data as { item: CreditPack };
}

// ---- Pro offers ----
export async function listProOffers() {
  const { data } = await api.get("/admin/pro-offers");
  return data as { items: ProOffer[] };
}

export async function createProOffer(input: Partial<ProOffer>) {
  const { data } = await api.post("/admin/pro-offers", input);
  return data as { item: ProOffer };
}

export async function updateProOffer(id: string, input: Partial<ProOffer>) {
  const { data } = await api.put(`/admin/pro-offers/${id}`, input);
  return data as { item: ProOffer };
}

// ---- Boosts ----
export async function listBoosts() {
  const { data } = await api.get("/admin/boosts/configs");
  return data as { items: BoostConfig[] };
}

export async function upsertBoost(input: Partial<BoostConfig>) {
  const { data } = await api.post("/admin/boosts/configs", input);
  return data as { item: BoostConfig };
}

export async function toggleBoost(id: string) {
  const { data } = await api.post(`/admin/boosts/configs/${id}/toggle`);
  return data as { item: BoostConfig };
}

// ---- Pricing ----
export async function listPricing() {
  const { data } = await api.get("/admin/monetization/pricing");
  return data as { items: CountryPricing[] };
}

export async function upsertPricing(input: Partial<CountryPricing>) {
  const { data } = await api.post("/admin/monetization/pricing", input);
  return data as { item: CountryPricing };
}
