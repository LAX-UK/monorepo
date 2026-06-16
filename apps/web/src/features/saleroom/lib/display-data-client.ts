import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type {
  SaleroomDisplayPairPollResult,
  SaleroomDisplayPairingStart,
  SaleroomDisplaySnapshot,
} from "@auction/types";

export type DisplaySnapshotFetchResult =
  | { ok: true; snapshot: SaleroomDisplaySnapshot }
  | { ok: false; unauthorized: true }
  | { ok: false; unauthorized?: false };

export type DisplayHeartbeatResult = "ok" | "unauthorized" | "error";

export type DisplayDataClient = {
  startPairing(): Promise<SaleroomDisplayPairingStart | null>;
  pollPairing(deviceCode: string): Promise<SaleroomDisplayPairPollResult | null>;
  fetchSnapshot(saleId: string, displayToken: string): Promise<DisplaySnapshotFetchResult>;
  sendHeartbeat(displayToken: string): Promise<DisplayHeartbeatResult>;
};

export function createDisplayDataClient(): DisplayDataClient {
  const base = browserApiBase();

  return {
    async startPairing() {
      try {
        const res = await browserFetch(`${base}/display/pair/start`, { method: "POST" });
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: SaleroomDisplayPairingStart };
        return body.data ?? null;
      } catch {
        return null;
      }
    },
    async pollPairing(deviceCode) {
      try {
        const res = await browserFetch(`${base}/display/pair/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode }),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: SaleroomDisplayPairPollResult };
        return body.data ?? null;
      } catch {
        return null;
      }
    },
    async fetchSnapshot(saleId, displayToken) {
      try {
        const res = await browserFetch(`${base}/display/${encodeURIComponent(saleId)}/snapshot`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${displayToken}` },
        });
        if (res.status === 401) return { ok: false, unauthorized: true };
        if (!res.ok) return { ok: false };
        const body = (await res.json()) as { data?: SaleroomDisplaySnapshot };
        if (!body.data) return { ok: false };
        return { ok: true, snapshot: body.data };
      } catch {
        return { ok: false };
      }
    },
    async sendHeartbeat(displayToken) {
      try {
        const res = await browserFetch(`${base}/display/heartbeat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${displayToken}` },
        });
        if (res.status === 401) return "unauthorized";
        return res.ok ? "ok" : "error";
      } catch {
        return "error";
      }
    },
  };
}

export const DISPLAY_TOKEN_STORAGE_KEY = (saleId: string) => `saleroom-display-token:${saleId}`;
