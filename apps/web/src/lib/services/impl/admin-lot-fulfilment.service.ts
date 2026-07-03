import type { IAuthedApiClient } from "../http/authed-api-client";
import type { IAdminLotFulfilmentService } from "../interfaces/admin-lot-fulfilment-service";

function lotFulfilmentPath(lotId: string, suffix: string): string {
  return `/admin/lot-fulfilment/${encodeURIComponent(lotId)}/${suffix}`;
}

export class AdminLotFulfilmentService implements IAdminLotFulfilmentService {
  constructor(private readonly api: IAuthedApiClient) {}

  release(lotId: string, body: { notes?: string | undefined }) {
    return this.api.json<unknown>(lotFulfilmentPath(lotId, "release"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  ship(lotId: string, body: { carrier: string; trackingNumber: string }) {
    return this.api.json<unknown>(lotFulfilmentPath(lotId, "ship"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  readyForCollection(lotId: string) {
    return this.api.json<unknown>(lotFulfilmentPath(lotId, "ready-for-collection"), {
      method: "POST",
    });
  }

  delivered(lotId: string) {
    return this.api.json<unknown>(lotFulfilmentPath(lotId, "delivered"), { method: "POST" });
  }

  collected(lotId: string, body: { collectedBy: string }) {
    return this.api.json<unknown>(lotFulfilmentPath(lotId, "collected"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}
