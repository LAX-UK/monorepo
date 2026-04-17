import "server-only";

import type { ListAuctionsParams } from "@/lib/data/contracts";
import { buildAuctionListQuery } from "@/lib/data/http/auctions.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { parseAuction } from "@/lib/data/http/parse";
import type { Auction } from "@auction/types";
import type { PaymentStatus } from "@auction/types";

export type AdminPaymentRow = {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
  createdAt: Date;
};

function isPaymentStatus(s: string): s is PaymentStatus {
  return s === "pending" || s === "authorized" || s === "captured" || s === "refunded";
}

function parseAdminPaymentRow(raw: unknown): AdminPaymentRow {
  const o = raw as Record<string, unknown>;
  const status = typeof o.status === "string" && isPaymentStatus(o.status) ? o.status : "pending";
  return {
    id: String(o.id ?? ""),
    auctionId: String(o.auctionId ?? ""),
    buyerId: String(o.buyerId ?? ""),
    sellerId: String(o.sellerId ?? ""),
    amount: String(o.amount ?? "0"),
    platformFee: String(o.platformFee ?? "0"),
    status,
    createdAt: o.createdAt instanceof Date ? o.createdAt : new Date(String(o.createdAt ?? "")),
  };
}

export async function getAdminAuctionList(params: ListAuctionsParams = {}): Promise<Auction[]> {
  const qs = new URLSearchParams(
    buildAuctionListQuery({ limit: params.limit ?? 100, offset: params.offset ?? 0, ...params }),
  );
  const res = await authedServerFetch(`/auctions?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load auctions: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAuction);
}

export async function getAdminAuctionById(id: string): Promise<Auction | null> {
  const res = await authedServerFetch(`/auctions/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load auction: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown };
  return parseAuction(body.data);
}

export async function getAdminPaymentList(): Promise<AdminPaymentRow[]> {
  const res = await authedServerFetch("/payments");
  if (!res.ok) {
    throw new Error(`Failed to load payments: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminPaymentRow);
}
