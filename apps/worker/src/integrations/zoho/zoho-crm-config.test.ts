import { describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../env.js";
import {
  isZohoEventTypeEnabled,
  resolveZohoDeliveryMode,
  zohoCrmAllowlistIssues,
} from "./zoho-crm-config.js";

function env(partial: Partial<WorkerEnv>): WorkerEnv {
  return partial as WorkerEnv;
}

describe("isZohoEventTypeEnabled", () => {
  it("always enables lifecycle events when person sync is allowlisted", () => {
    const e = env({
      ZOHO_CRM_SYNC_MODE: "live",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered",
    });
    expect(isZohoEventTypeEnabled(e, "user.identity_deleted")).toBe(true);
    expect(isZohoEventTypeEnabled(e, "user.deletion_requested")).toBe(true);
    expect(isZohoEventTypeEnabled(e, "bid.lot_won")).toBe(false);
  });

  it("runs a guest lead's erasure wherever guest leads are synced", () => {
    const synced = env({
      ZOHO_CRM_SYNC_MODE: "live",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "shop.guest_lead.recorded",
    });
    expect(isZohoEventTypeEnabled(synced, "shop.guest_lead.erased")).toBe(true);
    const notSynced = env({
      ZOHO_CRM_SYNC_MODE: "live",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered",
    });
    expect(isZohoEventTypeEnabled(notSynced, "shop.guest_lead.erased")).toBe(false);
  });

  it("runs an account purge and a guest erasure wherever enquiries are synced", () => {
    const enquiriesOnly = env({
      ZOHO_CRM_SYNC_MODE: "live",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "marketing_enquiry.received",
    });
    expect(isZohoEventTypeEnabled(enquiriesOnly, "user.identity_deleted")).toBe(true);
    expect(isZohoEventTypeEnabled(enquiriesOnly, "shop.guest_lead.erased")).toBe(true);
    expect(isZohoEventTypeEnabled(enquiriesOnly, "user.deletion_requested")).toBe(false);
  });

  it("makes no erasure call in dry_run or off", () => {
    const types = "marketing_enquiry.received";
    expect(
      resolveZohoDeliveryMode(
        env({ ZOHO_CRM_SYNC_MODE: "dry_run", ZOHO_CRM_ENABLED_EVENT_TYPES: types }),
        "user.identity_deleted",
      ),
    ).toBe("dry_run");
    expect(
      resolveZohoDeliveryMode(
        env({ ZOHO_CRM_SYNC_MODE: "off", ZOHO_CRM_ENABLED_EVENT_TYPES: types }),
        "shop.guest_lead.erased",
      ),
    ).toBe("off");
  });

  it("respects dry_run for enabled types", () => {
    const e = env({
      ZOHO_CRM_SYNC_MODE: "dry_run",
      ZOHO_CRM_ENABLED_EVENT_TYPES: "user.registered",
    });
    expect(resolveZohoDeliveryMode(e, "user.registered")).toBe("dry_run");
    expect(resolveZohoDeliveryMode(e, "user.identity_deleted")).toBe("dry_run");
  });
});

describe("zohoCrmAllowlistIssues", () => {
  const configured = {
    ZOHO_CRM_AUCTION_PIPELINE: "Auction",
    ZOHO_CRM_DEAL_STAGE_LOT_WON: "Won",
    ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED: "Paid",
    ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED: "Refunded",
    ZOHO_CRM_DEAL_STAGE_SHOP_PAID: "Shop Paid",
  };
  const issues = (types: string, settings: Partial<typeof configured> = {}) =>
    zohoCrmAllowlistIssues({
      ...configured,
      ...settings,
      ZOHO_CRM_ENABLED_EVENT_TYPES: types,
    });

  it("accepts a valid allowlist", () => {
    expect(issues("user.registered")).toEqual([]);
    expect(issues("user.registered,shop.order.paid,shop.refund.completed")).toEqual([]);
    expect(issues("shop.order.paid,user.identity_deleted")).toEqual([]);
  });

  it("rejects an event type the CRM consumer does not receive", () => {
    expect(issues("user.registered,user.registred,shop.order.created")).toEqual([
      "ZOHO_CRM_ENABLED_EVENT_TYPES lists unknown event types: user.registred, shop.order.created",
    ]);
  });

  it("requires the pipeline and the stage of an enabled deal type", () => {
    expect(
      issues("user.registered,shop.order.paid", { ZOHO_CRM_DEAL_STAGE_SHOP_PAID: " " }),
    ).toEqual(["ZOHO_CRM_DEAL_STAGE_SHOP_PAID required when shop.order.paid is enabled"]);
    expect(
      issues("user.registered,shop.refund.completed", {
        ZOHO_CRM_AUCTION_PIPELINE: "",
        ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED: "",
      }),
    ).toEqual([
      "ZOHO_CRM_AUCTION_PIPELINE, ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED required when shop.refund.completed is enabled",
    ]);
    // A type that writes no stage needs none.
    expect(
      issues("user.registered,shop.fulfilment.status_changed", { ZOHO_CRM_AUCTION_PIPELINE: "" }),
    ).toEqual([]);
  });

  it("requires the erasure whenever a deal or Shop order type is on", () => {
    expect(issues("shop.order.paid,shop.fulfilment.status_changed")).toEqual([
      "user.identity_deleted must be enabled when shop.order.paid, shop.fulfilment.status_changed is enabled, so erasure removes those deals and notes",
    ]);
    // On with any person type, as the lifecycle events are.
    expect(issues("user.email_verified,bid.lot_won,payment.captured")).toEqual([]);
  });
});
