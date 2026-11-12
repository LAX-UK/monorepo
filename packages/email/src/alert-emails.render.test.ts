import type { DigestMessage } from "@auction/alerts";
import { assembleDigest } from "@auction/alerts";
import { describe, expect, it } from "vitest";
import { OutboxAlertMailer, digestDateLabel } from "./alert-mailer.js";
import { emailProductFor } from "./email-product.js";
import { renderEmail } from "./render.js";
import type { EmailEnqueueInput, IEmailService } from "./service.js";
import { isOptionalEmailTemplate } from "./suppression-policy.js";
import { RECIPIENT_RESOLUTION, type TemplateName } from "./types.js";

function recordingEmail() {
  const sent: EmailEnqueueInput<TemplateName>[] = [];
  const email: IEmailService = {
    async enqueue(input) {
      sent.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "o1" };
    },
  };
  return { sent, email };
}

const when = new Date("2026-11-04T08:00:00Z");
const sale = (title: string, n: number) => ({
  id: `m${n}`,
  subscriberId: "s1",
  topic: "bid.new_sales" as const,
  itemKey: `sale:${n}`,
  groupKey: null,
  snapshot: {
    title,
    subtitle: "Online · opens Wed 18 Nov, closes Thu 26 Nov",
    detail: "214 lots",
    path: `/sales/${n}`,
  },
  matchedAt: when,
});

function message(over: Partial<DigestMessage> = {}): DigestMessage {
  const vm = assembleDigest([sale("Modern British and Irish Art", 1)]);
  if (!vm) throw new Error("no digest");
  return {
    product: "bid",
    to: "client@example.com",
    subscriberId: "s1",
    localDate: "2026-11-04",
    idempotencyKey: "alert-digest:bid:s1:2026-11-04",
    vm,
    activeTopics: ["bid.new_sales"],
    siteUrl: (p) => `https://lax.bid${p}`,
    stopUrl: "https://lax.bid/alerts/unsubscribe?t=STOP",
    oneClickUrl: "https://lax.bid/alerts/unsubscribe?t=STOP",
    manageUrl: "https://lax.bid/settings#alerts",
    audience: "account",
    viewerZone: null,
    changeZoneUrl: null,
    ...over,
  };
}

describe("alert emails", () => {
  it("formats the London day of a digest", () => {
    expect(digestDateLabel("2026-11-04")).toBe("Wednesday 4 November");
    expect(digestDateLabel("2026-07-01")).toBe("Wednesday 1 July");
    expect(digestDateLabel("2026-10-25")).toBe("Sunday 25 October");
    expect(digestDateLabel("2026-03-29")).toBe("Sunday 29 March");
  });

  it("sends the confirmation at once on the transactional stream with a stable key", async () => {
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendConfirmation({
      product: "bid",
      to: "a@example.com",
      subscriberId: "s1",
      requestedAtMs: 1234,
      confirmUrl: "https://lax.bid/alerts/confirm?t=C",
      stopUrl: "https://lax.bid/alerts/unsubscribe?t=S",
      oneClickUrl: "https://lax.bid/alerts/unsubscribe?t=S",
      expirationHours: 48,
    });
    expect(sent[0]).toMatchObject({
      template: "alert-confirm",
      idempotencyKey: "alert-confirm:s1:1234",
      category: "transactional",
    });
    expect(sent[0]?.stream).toBeUndefined();
  });

  it("sends the digest on the broadcast stream under the digest key", async () => {
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendDigest(message());
    expect(sent[0]).toMatchObject({
      template: "alert-digest",
      stream: "broadcast",
      idempotencyKey: "alert-digest:bid:s1:2026-11-04",
    });
  });

  it("renders the Bid confirmation as LAX Bid mail naming its company", async () => {
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendConfirmation({
      product: "bid",
      to: "a@example.com",
      subscriberId: "s1",
      requestedAtMs: 1,
      confirmUrl: "https://lax.bid/alerts/confirm?t=C",
      stopUrl: "https://lax.bid/alerts/unsubscribe?t=S",
      oneClickUrl: "https://lax.bid/alerts/unsubscribe?t=S",
      expirationHours: 48,
    });
    const first = sent[0] as EmailEnqueueInput<"alert-confirm">;
    const rendered = await renderEmail("alert-confirm", first.vars);
    expect(rendered.subject).toBe("Confirm your LAX Bid sale alerts");
    expect(rendered.text).toContain("https://lax.bid/alerts/confirm?t=C");
    expect(rendered.text).toContain("48 hours");
    expect(rendered.text).toContain("Never email this address about sale alerts");
    expect(rendered.text).toContain("London Auction Xchange LTD");
    expect(rendered.text).not.toContain("London Art Exchange");
  });

  it("renders the Bid digest for a signed-in client with a manage link and the company", async () => {
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendDigest(message());
    const vars = (sent[0] as EmailEnqueueInput<"alert-digest">).vars;
    const rendered = await renderEmail("alert-digest", vars);
    expect(rendered.subject).toBe("New sale: Modern British and Irish Art");
    expect(rendered.text).toContain("Wednesday 4 November");
    expect(rendered.html).toContain("New sale: Modern British and Irish Art");
    expect(rendered.text).toContain("https://lax.bid/sales/1");
    expect(rendered.text).toContain("214 lots");
    expect(rendered.text).toContain("Manage your alerts");
    expect(rendered.text).toContain("https://lax.bid/settings#alerts");
    expect(rendered.text).toContain("Stop these emails");
    expect(rendered.text).toContain(
      "You get this because you asked LAX Bid for alerts about new sales. At most one email a day.",
    );
    expect(rendered.text).not.toContain("artists you follow");
    // The only group is the whole email, so its heading would repeat the title.
    expect(rendered.html).not.toContain(">New sales<");
    expect(rendered.text).toContain("London Auction Xchange LTD");
  });

  it("renders a visitor digest with no manage link, naming the address", async () => {
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendDigest(
      message({ audience: "visitor", manageUrl: null, to: "v@example.com" }),
    );
    const vars = (sent[0] as EmailEnqueueInput<"alert-digest">).vars;
    const rendered = await renderEmail("alert-digest", vars);
    expect(rendered.text).not.toContain("Manage your alerts");
    expect(rendered.text).toContain("Stop sale alerts to this address");
    expect(rendered.text).toContain("v@example.com");
  });

  it("links to all matches when a group is cut off", async () => {
    const many = Array.from({ length: 8 }, (_, i) => sale(`Sale ${i}`, i + 1));
    const vm = assembleDigest(many);
    if (!vm) throw new Error("no digest");
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendDigest(message({ vm }));
    const rendered = await renderEmail(
      "alert-digest",
      (sent[0] as EmailEnqueueInput<"alert-digest">).vars,
    );
    expect(rendered.text).toContain("See all 8 matches");
    expect(rendered.text).toContain("https://lax.bid/sales");
  });

  it("names the company of the product that sends it", async () => {
    const shop = await renderEmail("alert-confirm", {
      product: "shop",
      subject: "Confirm your LAX Shop release alerts",
      title: "Confirm your release alerts",
      intro: "Confirm.",
      buttonLabel: "Confirm release alerts",
      confirmUrl: "https://lax.art/alerts/confirm?t=C",
      expirationHours: 48,
      sourceName: "LAX Shop release alerts form",
      unsubscribeUrl: "https://lax.art/alerts/unsubscribe?t=S",
      listUnsubscribeUrl: "https://lax.art/alerts/unsubscribe?t=S",
      stopLabel: "Never email this address about release alerts",
    });
    expect(shop.text).toContain("London Art Exchange Ltd");
    expect(shop.text).not.toContain("London Auction Xchange");
  });

  it("belongs to the product named in its variables, is optional mail and is addressed from a snapshot", () => {
    for (const product of ["bid", "shop", "art"] as const) {
      expect(emailProductFor("alert-digest", { product } as never)).toBe(product);
    }
    expect(isOptionalEmailTemplate("alert-digest")).toBe(true);
    expect(isOptionalEmailTemplate("alert-confirm")).toBe(true);
    expect(RECIPIENT_RESOLUTION["alert-digest"]).toBe("snapshot");
    expect(RECIPIENT_RESOLUTION["alert-confirm"]).toBe("snapshot");
  });

  it("names every active topic, leads with the sale and keeps group headings when there are several", async () => {
    const lot = (title: string, n: number, topic: "bid.artists" | "bid.searches") => ({
      id: `l${n}`,
      subscriberId: "s1",
      topic,
      itemKey: `lot:${n}`,
      groupKey: null,
      snapshot: { title, path: `/lots/${n}` },
      matchedAt: when,
    });
    const vm = assembleDigest([
      sale("Modern British and Irish Art", 1),
      lot("Low tide at Maldon", 2, "bid.artists"),
      lot("Cafe interior", 3, "bid.searches"),
    ]);
    if (!vm) throw new Error("no digest");
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendDigest(
      message({ vm, activeTopics: ["bid.new_sales", "bid.artists", "bid.searches"] }),
    );
    const rendered = await renderEmail(
      "alert-digest",
      (sent[0] as EmailEnqueueInput<"alert-digest">).vars,
    );
    expect(rendered.subject).toBe("New sale: Modern British and Irish Art, and 2 lots for you");
    expect(rendered.html).toContain("New sale: Modern British and Irish Art");
    expect(rendered.text).toContain(
      "You get this because you asked LAX Bid for alerts about new sales, artists you follow and saved searches. At most one email a day.",
    );
    for (const heading of ["New sales", "Artists you follow", "Your saved searches"]) {
      expect(rendered.html).toContain(`>${heading}<`);
    }
  });

  it("does not claim topics the person has switched off", async () => {
    const { sent, email } = recordingEmail();
    await new OutboxAlertMailer({ email }).sendDigest(
      message({ activeTopics: ["bid.new_sales", "bid.searches"] }),
    );
    const rendered = await renderEmail(
      "alert-digest",
      (sent[0] as EmailEnqueueInput<"alert-digest">).vars,
    );
    expect(rendered.text).toContain("alerts about new sales and saved searches.");
    expect(rendered.text).not.toContain("artists you follow");
  });
});
