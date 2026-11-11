import { assembleDigest } from "@auction/alerts";
import type { DigestMessage } from "@auction/alerts";
import { describe, expect, it } from "vitest";
import { digestEmail } from "./alert-emails.js";
import { RecipientClock } from "./recipient-clock.js";
import { renderEmail } from "./render.js";

const CHANGE_ZONE_URL = "https://account.lax.bid/account/profile#time-zone";
const NOW = new Date("2026-11-11T12:00:00Z");

/** Who is reading: no saved zone, the official zone itself, and two places on other clocks. */
const RECIPIENTS = [
  { name: "no saved zone", zone: null },
  { name: "saved same as official", zone: "Europe/London" },
  { name: "saved Cairo", zone: "Africa/Cairo" },
  // 18:00 in London is 05:00 the next day in Sydney.
  { name: "saved Sydney", zone: "Australia/Sydney" },
] as const;

const CLOSES = new Date("2026-11-12T18:00:00Z");
const DUE = new Date("2026-11-12T23:59:59.999Z");

function watchedVars(zone: string | null) {
  const clock = new RecipientClock(zone, NOW, CHANGE_ZONE_URL);
  const closesAt = clock.moment(CLOSES);
  return {
    userName: "Wendy",
    lotTitle: "Red chair, evening",
    lotUrl: "https://lax.bid/lots/red-chair",
    unsubscribeUrl: "https://lax.bid/unsubscribe?t=x",
    kind: "hour_before_close" as const,
    note: "Check the frame",
    closesAt,
    ...(clock.zoneNote ? { zoneNote: clock.zoneNote } : {}),
  };
}

function reminderVars(zone: string | null, privateSale: boolean) {
  const clock = new RecipientClock(zone, NOW, CHANGE_ZONE_URL);
  const due = clock.moment(DUE);
  return {
    userName: "Maya",
    step: "due_day" as const,
    lotTitle: "Harbour at dusk",
    ...(privateSale ? { itemLabel: "Work" as const } : {}),
    amount: "£1,250.00",
    dueDate: "12 November 2026",
    due,
    ...(clock.zoneNote ? { zoneNote: clock.zoneNote } : {}),
    payUrl: "https://lax.bid/purchases/checkout/lot-1",
    supportContactEmail: "support@lax.bid",
    held: null,
    actionUrl: null,
  };
}

function digestVars(zone: string | null) {
  const vm = assembleDigest([
    {
      id: "m1",
      subscriberId: "s1",
      topic: "bid.new_sales",
      itemKey: "sale:1",
      groupKey: null,
      snapshot: {
        title: "Modern British and Irish Art",
        subtitle: "Online",
        detail: "214 lots",
        moments: [
          { label: "Opens", at: "2026-11-12T10:00:00.000Z", zone: "Europe/London" },
          { label: "Closes", at: "2026-11-12T18:00:00.000Z", zone: "Europe/London" },
        ],
        path: "/sales/1",
      },
      matchedAt: new Date("2026-11-11T08:00:00Z"),
    },
  ]);
  if (!vm) throw new Error("no digest");
  const message: DigestMessage = {
    product: "bid",
    to: "a@example.com",
    subscriberId: "s1",
    localDate: "2026-11-11",
    idempotencyKey: "alert-digest:bid:s1:2026-11-11",
    vm,
    activeTopics: ["bid.new_sales"],
    siteUrl: (path) => `https://lax.bid${path}`,
    stopUrl: "https://lax.bid/alerts/unsubscribe?t=STOP",
    oneClickUrl: "https://lax.bid/alerts/unsubscribe?t=STOP",
    manageUrl: "https://lax.bid/settings#alerts",
    audience: "account",
    viewerZone: zone,
    changeZoneUrl: CHANGE_ZONE_URL,
  };
  return digestEmail(message).vars;
}

const FOOTER = "time comes from your LAX Account.";

describe.each(RECIPIENTS)("$name", ({ zone }) => {
  const hasLocal = zone !== null && zone !== "Europe/London";

  it("renders the watched-lot reminder", async () => {
    const rendered = await renderEmail("watched-lot-reminder", watchedVars(zone));
    expect(rendered.text).toContain("Thu 12 Nov, 18:00 GMT");
    expect(rendered.text.includes(FOOTER)).toBe(hasLocal);
    expect(rendered).toMatchSnapshot();
  });

  it("renders the payment reminder for a lot", async () => {
    const rendered = await renderEmail("payment-reminder", reminderVars(zone, false));
    expect(rendered.text).toContain("Thu 12 Nov, 23:59 GMT");
    expect(rendered.text.includes(FOOTER)).toBe(hasLocal);
    expect(rendered).toMatchSnapshot();
  });

  it("renders the payment reminder for a private sale deal", async () => {
    const rendered = await renderEmail("payment-reminder", reminderVars(zone, true));
    expect(rendered.text).toContain("Thu 12 Nov, 23:59 GMT");
    expect(rendered.text.includes(FOOTER)).toBe(hasLocal);
    expect(rendered).toMatchSnapshot();
  });

  it("renders the new-sale alert digest", async () => {
    const rendered = await renderEmail("alert-digest", digestVars(zone));
    expect(rendered.text).toContain("Opens Thu 12 Nov, 10:00 GMT");
    expect(rendered.text).toContain("Closes Thu 12 Nov, 18:00 GMT");
    expect(rendered.text.includes(FOOTER)).toBe(hasLocal);
    expect(rendered).toMatchSnapshot();
  });
});

describe("local times", () => {
  it("name the day when it differs, and only then", async () => {
    const sydney = await renderEmail("watched-lot-reminder", watchedVars("Australia/Sydney"));
    expect(sydney.text).toContain("Fri 13 Nov, 05:00 in Sydney");
    expect(sydney.text).toContain("Sydney time comes from your LAX Account.");
    expect(sydney.html).toContain(CHANGE_ZONE_URL);
    const cairo = await renderEmail("watched-lot-reminder", watchedVars("Africa/Cairo"));
    expect(cairo.text).toContain("20:00 in Cairo");
    expect(cairo.text).not.toContain("Cairo, 20:00");
  });

  it("show a digest's opening and closing on the reader's clock", async () => {
    const sydney = await renderEmail("alert-digest", digestVars("Australia/Sydney"));
    expect(sydney.text).toContain("21:00 in Sydney");
    expect(sydney.text).toContain("Fri 13 Nov, 05:00 in Sydney");
  });
});
