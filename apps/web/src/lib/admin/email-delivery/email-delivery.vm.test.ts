import { pinClock } from "@/test/pin-clock";
import type { EmailBlockView, PersonEmailDeliveryView } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildEmailDeliveryPanelVm } from "./email-delivery.vm";

const block = (over: Partial<EmailBlockView> = {}): EmailBlockView => ({
  reason: "hard_bounce",
  since: "2026-10-28T16:02:00.000Z",
  providerDetail: "550 5.1.1 mailbox does not exist",
  stopsEssentialEmail: true,
  liftReasons: ["mailbox_fixed", "other"],
  noteRequired: false,
  writtenRequestRequired: false,
  lift: { allowed: true },
  ...over,
});

const view = (over: Partial<PersonEmailDeliveryView> = {}): PersonEmailDeliveryView => ({
  addressStatus: "bounced",
  lastDeliveredAt: "2026-10-27T08:30:00.000Z",
  alerts: null,
  block: block(),
  sends: [
    {
      id: "s1",
      label: "Invoice",
      essential: true,
      product: "bid",
      status: "not_sent_blocked",
      createdAt: "2026-11-03T09:14:00.000Z",
      sentAt: null,
      events: [],
    },
  ],
  ...over,
});

const build = (v: PersonEmailDeliveryView, viewerCanLift = true) =>
  buildEmailDeliveryPanelVm({ view: v, personName: "Ana Duarte", viewerCanLift });

pinClock();

describe("email delivery panel view model", () => {
  it("says what the block stops in the person's first name", () => {
    const vm = build(view());
    expect(vm.badge).toEqual({ label: "Blocked", tone: "danger" });
    expect(vm.block?.body).toContain("No email reaches Ana, including invoices");
    expect(vm.block?.body.startsWith("Since Wed 28 Oct, 16:02 GMT.")).toBe(true);
    expect(vm.block?.detail).toBe("550 5.1.1 mailbox does not exist");
    expect(vm.skippedCount).toBe(1);
  });

  it("shows the lift button, disables it with the server's reason, or leaves it out", () => {
    expect(build(view()).block?.lift).toEqual({ kind: "enabled" });
    const refused = view({
      block: block({
        lift: { allowed: false, reason: "Only an administrator can lift a complaint block" },
      }),
    });
    expect(build(refused).block?.lift).toEqual({
      kind: "disabled",
      reason: "Only an administrator can lift a complaint block",
    });
    expect(build(view(), false).block?.lift).toEqual({ kind: "hidden" });
  });

  it("treats an unsubscribe as the person's choice: neutral, essential email still goes, no lift", () => {
    const vm = build(
      view({
        addressStatus: "ok",
        block: block({
          reason: "unsubscribe",
          stopsEssentialEmail: false,
          liftReasons: [],
          lift: { allowed: false, reason: "Only the person can turn optional email back on" },
        }),
      }),
    );
    expect(vm.badge).toEqual({ label: "Optional off", tone: "neutral" });
    expect(vm.block?.tone).toBe("info");
    expect(vm.block?.lift).toEqual({ kind: "hidden" });
    expect(vm.facts[0]?.value).toBe("Delivering essential email");
  });

  it("reports a healthy address and the alert state", () => {
    const vm = build(
      view({ addressStatus: "ok", block: null, alerts: { state: "stopped_after_complaint" } }),
    );
    expect(vm.badge).toEqual({ label: "Delivering", tone: "success" });
    expect(vm.block).toBeNull();
    expect(vm.facts.find((fact) => fact.label === "Alerts")?.value).toBe(
      "Stopped after a complaint",
    );
  });

  it("maps statuses to words and tones, never the template id", () => {
    const row = build(view()).sends[0];
    expect(row?.status).toEqual({ label: "Not sent: blocked", tone: "warning" });
    expect(row?.necessity).toBe("Essential");
    expect(row?.product).toBe("LAX Bid");
  });
});
