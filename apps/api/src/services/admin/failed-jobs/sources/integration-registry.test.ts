import type { FailedJobSource } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  integrationEndpoint,
  integrationQueueId,
  integrationQueueLabel,
  nameFilterFor,
  parseIntegrationQueueId,
} from "./integration-registry.js";

const set = (...sources: FailedJobSource[]) => new Set<FailedJobSource>(sources);

describe("integrationEndpoint", () => {
  it("puts Xero deliveries and Xero webhooks under the Xero scope", () => {
    expect(integrationEndpoint("delivery", "xero").scope).toBe("integrations.xero");
    expect(integrationEndpoint("webhook", "xero").scope).toBe("integrations.xero");
  });

  it("keeps a retried Xero delivery safe to repeat and a webhook not", () => {
    expect(integrationEndpoint("delivery", "xero").mayRepeat).toBe(false);
    expect(integrationEndpoint("webhook", "stripe").mayRepeat).toBe(true);
  });

  it("files a name nobody has listed under other integrations", () => {
    expect(integrationEndpoint("delivery", "new_crm")).toMatchObject({
      scope: "integrations.other",
      label: "New crm",
    });
  });
});

describe("nameFilterFor", () => {
  it("is open for someone who reads every integration", () => {
    const all = set("integrations.xero", "integrations.zoho", "integrations.other");
    expect(nameFilterFor("delivery", all)).toBeNull();
    expect(nameFilterFor("webhook", all)).toBeNull();
  });

  it("limits finance to Xero by name", () => {
    expect(nameFilterFor("delivery", set("integrations.xero"))).toEqual({
      mode: "in",
      names: ["xero"],
    });
    expect(nameFilterFor("webhook", set("integrations.xero"))).toEqual({
      mode: "in",
      names: ["xero"],
    });
  });

  it("excludes Xero by name for someone who reads the rest, so new names stay visible", () => {
    const rest = set("integrations.zoho", "integrations.other");
    expect(nameFilterFor("delivery", rest)).toEqual({ mode: "not_in", names: ["xero"] });
  });

  it("matches nothing when no integration may be read", () => {
    expect(nameFilterFor("delivery", set("background_jobs"))).toEqual({ mode: "in", names: [] });
  });
});

describe("queue ids", () => {
  it("round-trip", () => {
    expect(parseIntegrationQueueId(integrationQueueId("webhook", "stripe"))).toEqual({
      kind: "webhook",
      name: "stripe",
    });
  });

  it("does not mistake a background queue for an integration", () => {
    expect(parseIntegrationQueueId("email")).toBeNull();
    expect(parseIntegrationQueueId("delivery:")).toBeNull();
  });

  it("words a webhook as plural", () => {
    expect(integrationQueueLabel("webhook", "stripe")).toBe("Stripe webhooks");
    expect(integrationQueueLabel("delivery", "zoho")).toBe("Zoho CRM");
  });
});
