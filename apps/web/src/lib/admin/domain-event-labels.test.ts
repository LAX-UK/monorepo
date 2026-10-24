import { ALL_LIVE_DOMAIN_EVENT_TYPES } from "@auction/types";
import { describe, expect, it } from "vitest";
import { auditActionOptions } from "./audit/audit-action-options";
import { domainEventLabel, hasDomainEventLabel } from "./domain-event-labels";

describe("domainEventLabel", () => {
  it("maps staff-facing codes to sentences", () => {
    expect(domainEventLabel("auth.two_factor_reset_by_staff")).toBe(
      "Two-step verification reset by staff",
    );
    expect(domainEventLabel("lot.withdrawal_declined")).toBe("Withdrawal declined");
  });

  it("has a written label for every event the platform emits", () => {
    const missing = ALL_LIVE_DOMAIN_EVENT_TYPES.filter((type) => !hasDomainEventLabel(type));
    expect(missing).toEqual([]);
  });

  it("falls back to a sentence, never the raw code", () => {
    expect(domainEventLabel("shop.widget.polished_by_hand")).toBe("Widget polished by hand");
    expect(domainEventLabel("mystery")).toBe("Mystery");
    expect(domainEventLabel("new_thing.happened_today")).toBe("Happened today");
  });

  it("keeps labels in sentence case", () => {
    for (const type of ALL_LIVE_DOMAIN_EVENT_TYPES) {
      expect(domainEventLabel(type)).toMatch(/^[A-Z]/);
      expect(domainEventLabel(type)).not.toContain("_");
    }
  });
});

describe("auditActionOptions", () => {
  it("offers each live event once, sorted by label", () => {
    const options = auditActionOptions();
    expect(options).toHaveLength(new Set(ALL_LIVE_DOMAIN_EVENT_TYPES).size);
    const labels = options.map((option) => option.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});
