import type { IAuthedApiClient } from "../http/authed-api-client";
import type { IAdminSaleroomService } from "../interfaces/admin-saleroom-service";

function saleroomPath(saleId: string, suffix: string): string {
  return `/admin/sales/${encodeURIComponent(saleId)}/saleroom/${suffix}`;
}

export class AdminSaleroomService implements IAdminSaleroomService {
  constructor(private readonly api: IAuthedApiClient) {}

  goLive(saleId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "go-live"), { method: "POST" });
  }

  pause(saleId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "pause"), { method: "POST" });
  }

  resume(saleId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "resume"), { method: "POST" });
  }

  advance(saleId: string, lotId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "advance"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotId }),
    });
  }

  hammer(saleId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "hammer"), { method: "POST" });
  }

  noSale(saleId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "no-sale"), { method: "POST" });
  }

  close(saleId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "close"), { method: "POST" });
  }

  displayApprove(saleId: string, userCode: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "display/approve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userCode: userCode.toUpperCase() }),
    });
  }

  displayOverlay(saleId: string, kind: "fair_warning" | "announcement", message?: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "display/overlay"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...(message ? { message } : {}) }),
    });
  }

  displayClearOverlay(saleId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "display/overlay"), { method: "DELETE" });
  }

  displayRevoke(saleId: string, pairingId: string) {
    return this.api.json<unknown>(saleroomPath(saleId, "display/revoke"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId }),
    });
  }
}
