import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("renderEmail", () => {
  it("renders a consignment update with the heading and message its sender wrote", async () => {
    const rendered = await renderEmail("consignment-update", {
      userName: "Jane",
      heading: "Your specialist confirmed what happens next",
      message: '"Untitled (Blue)" will be relisted with a reserve of £4,000.',
      submissionUrl: "https://lax.bid/selling/consignments/abc",
      unsubscribeUrl: "https://lax.bid/unsubscribe",
    });
    expect(rendered.subject).toBe("An update on your LAX.BID consignment");
    expect(rendered.html).toContain("Your specialist confirmed what happens next");
    expect(rendered.text).toContain("will be relisted with a reserve of £4,000.");
    expect(rendered.html).toContain("https://lax.bid/selling/consignments/abc");
  });

  it("brands artwork enquiry alerts by storefront, defaulting to Shop", async () => {
    const vars = {
      artworkTitle: "Tidal Forms",
      artworkSlug: "tidal-forms",
      artworkUrl: "https://lax.art/artworks/tidal-forms",
      buyerEmail: "ada@example.com",
    };
    const art = await renderEmail("shop-artwork-enquiry-alert", { ...vars, storefront: "art" });
    expect(art.subject).toBe("New lax.art artwork enquiry");
    expect(art.html).toContain("lax.art enquiry");

    const legacy = await renderEmail("shop-artwork-enquiry-alert", vars);
    expect(legacy.subject).toBe("New Shop artwork enquiry");
  });

  it("renders lax.art general enquiry alerts with topic and context", async () => {
    const rendered = await renderEmail("art-general-enquiry-alert", {
      topicLabel: "Private viewing",
      buyerEmail: "ada@example.com",
      message: "Saturday morning?",
      contextSlug: "lax-marylebone",
    });
    expect(rendered.subject).toBe("New lax.art enquiry: Private viewing");
    expect(rendered.text).toContain("Regarding: lax-marylebone");
    expect(rendered.text).toContain("Saturday morning?");
  });

  it("names guest enquiry senders so staff know there is no account to look up", async () => {
    const rendered = await renderEmail("art-general-enquiry-alert", {
      topicLabel: "General enquiry",
      buyerEmail: "grace@example.com",
      buyerName: "Grace Hopper",
      guest: true,
      message: "Do you ship to Edinburgh?",
    });
    expect(rendered.text).toContain("Name: Grace Hopper");
    expect(rendered.text).toContain(
      "Contact email (sent without a LAX account): grace@example.com",
    );

    const artwork = await renderEmail("shop-artwork-enquiry-alert", {
      artworkTitle: "Tidal Forms",
      artworkSlug: "tidal-forms",
      artworkUrl: "https://lax.art/artworks/tidal-forms",
      buyerEmail: "grace@example.com",
      buyerName: "Grace Hopper",
      guest: true,
      storefront: "art",
    });
    expect(artwork.text).toContain("Name: Grace Hopper");
    expect(artwork.text).toContain("sent without a LAX account");
  });

  it("renders auth templates to html and plaintext", async () => {
    const rendered = await renderEmail("verify-email", {
      verificationUrl: "https://lax.bid/verify",
      userName: "Ada",
    });

    expect(rendered.subject).toBe("Verify your LAX Account email");
    expect(rendered.html).toContain("Verify your email");
    expect(rendered.text).toContain("Confirm this email address");
  });

  it("renders sign-in-link for returning users with a password", async () => {
    const signInUrl = "https://lax.bid/auth/activate?token=abc";
    const rendered = await renderEmail("sign-in-link", {
      signInUrl,
      userName: "Ada",
      expirationMinutes: 15,
    });

    expect(rendered.subject).toBe("Your LAX Account sign-in link");
    expect(rendered.html).toContain("Sign in to your account");
    expect(rendered.html).toContain("Sign in");
    expect(rendered.text).toContain(signInUrl);
    expect(rendered.text).not.toContain("activate your account");
  });

  it("renders access-invite listing every platform role for a new address", async () => {
    const rendered = await renderEmail("access-invite", {
      scope: "staff",
      inviterName: "Grace",
      inviteeEmail: "new@example.com",
      grants: [
        { platform: "Bid", role: "Specialist", summary: "Appraises consignments." },
        { platform: "Shop", role: "Broker" },
      ],
      existingAccount: false,
      actionUrl: "https://lax.bid/register?invite=tok",
      expiresAt: "2026-10-17",
    });
    expect(rendered.subject).toBe("You're invited to join LAX");
    expect(rendered.html).toContain("Specialist — Appraises consignments.");
    expect(rendered.html).toContain("Broker");
    expect(rendered.text).toContain("Create account and accept");
    expect(rendered.text).toContain("https://lax.bid/register?invite=tok");
  });

  it("renders access-invite for an existing account joining an organisation", async () => {
    const rendered = await renderEmail("access-invite", {
      scope: "organisation",
      orgName: "Acme Gallery",
      inviteeEmail: "member@example.com",
      grants: [{ platform: "Acme Gallery", role: "Admin" }],
      existingAccount: true,
      actionUrl: "https://lax.bid/organisations/invitations/accept/tok",
    });
    expect(rendered.subject).toBe("You've been given access to Acme Gallery");
    expect(rendered.text).toContain("Acme Gallery on LAX Bid");
    expect(rendered.text).toContain("Accept and sign in");
  });

  it("renders shop-order-receipt", async () => {
    const rendered = await renderEmail("shop-order-receipt", {
      orderId: "ord-1",
      totalAmount: "GBP 120.00",
      vatAmount: "GBP 20.00",
      orderUrl: "https://shop.lax.art/account/orders/ord-1",
      lineSummary: "Print A (edition 1) — £120.00",
    });
    expect(rendered.subject).toContain("order confirmation");
    expect(rendered.text).toContain("ord-1");
  });

  it("names the order by its reference and leaves VAT out when none was recorded", async () => {
    const rendered = await renderEmail("shop-order-receipt", {
      orderId: "ord-1",
      orderReference: "LAX-S-10482",
      totalAmount: "£135.00",
      orderUrl: "https://shop.lax.art/account/orders/ord-1",
      lineSummary: "Warm Basket (edition 3) — £120.00",
    });
    expect(rendered.html).toContain("Order LAX-S-10482 is confirmed");
    expect(rendered.text).toContain("We received your payment of £135.00.");
    expect(rendered.text).not.toContain("VAT");

    const refund = await renderEmail("shop-refund-issued", {
      orderId: "ord-1",
      orderReference: "LAX-S-10482",
      amountPence: 4000,
      buyerEmail: "ada@example.com",
    });
    expect(refund.text).toContain("for your order LAX-S-10482");
  });

  it("tells a guest the receipt link opens the order and how to keep it in an account", async () => {
    const rendered = await renderEmail("shop-order-receipt", {
      orderId: "ord-1",
      orderReference: "LAX-S-10482",
      totalAmount: "£135.00",
      orderUrl: "https://shop.lax.art/orders/guest/token",
      lineSummary: "Warm Basket (edition 3) — £120.00",
      guest: true,
    });
    expect(rendered.text).toContain("without an account for 30 days");
    expect(rendered.text).toContain("Create a LAX account with this email");

    const link = await renderEmail("shop-guest-order-link", {
      orderReference: "LAX-S-10482",
      orderUrl: "https://shop.lax.art/orders/guest/token",
      expiresOn: "29 November 2026",
    });
    expect(link.subject).toBe("Your link to your LAX Shop order");
    expect(link.text).toContain("until 29 November 2026");
  });

  it("renders payment-invoice with bill-to block", async () => {
    const rendered = await renderEmail("payment-invoice", {
      userName: "Ada",
      invoiceNumber: "INV-100",
      amount: "GBP 500",
      invoiceUrl: "https://lax.bid/invoices/100",
      billTo: {
        kind: "organisation",
        billToName: "Acme Ltd",
        addressLines: ["1 High St", "London EC1", "GB"],
        vatLine: "VAT: GB123",
        poReference: "PO-4471",
        addressIncomplete: false,
      },
    });
    expect(rendered.subject).toBe("Payment invoice");
    expect(rendered.html).toContain("Bill to");
    expect(rendered.html).toContain("Acme Ltd");
    expect(rendered.html).toContain("VAT: GB123");
    expect(rendered.html).toMatch(/https?:\/\/.+\/email\/lax-logo\.png/);
  });

  it("renders the edition alert with its own reason and an unsubscribe link for the address", async () => {
    const rendered = await renderEmail("shop-edition-available-notify", {
      artworkTitle: "Reed Study",
      artistName: "Elias Moore",
      artworkUrl: "https://shop.lax.art/artworks/reed-study",
      unsubscribeUrl: "https://shop.lax.art/alerts/unsubscribe?token=abc",
    });
    expect(rendered.subject).toBe("Reed Study is available again");
    expect(rendered.text).toContain("An edition of Reed Study by Elias Moore can be bought again");
    expect(rendered.text).toContain("You asked LAX Shop to email you once");
    expect(rendered.text).not.toContain("relates to your order or your account");
    expect(rendered.html).toContain("Stop all edition alerts to this address");
    expect(rendered.html).toContain("https://shop.lax.art/alerts/unsubscribe?token=abc");
    expect(rendered.html).not.toContain("Unsubscribe from this notification type");
  });

  it("renders an edition alert queued before the artist and unsubscribe link were sent", async () => {
    const rendered = await renderEmail("shop-edition-available-notify", {
      artworkTitle: "Reed Study",
      artworkUrl: "https://shop.lax.art/artworks/reed-study",
    });
    expect(rendered.text).toContain("An edition of Reed Study can be bought again");
    expect(rendered.html).not.toContain("Stop all edition alerts");
  });

  it("renders opt-outable notification templates with unsubscribe copy", async () => {
    const rendered = await renderEmail("bid-outbid", {
      userName: "Ada",
      lotTitle: "Untitled",
      lotUrl: "https://lax.bid/lot/lot",
      currentBid: "GBP 100",
      unsubscribeUrl: "https://lax.bid/unsubscribe?t=token",
    });

    expect(rendered.subject).toBe("You've been outbid");
    expect(rendered.html).toContain("Unsubscribe from this notification type");
    expect(rendered.text).toContain("GBP 100");
  });

  it("renders admin impersonation notice with dynamic subject", async () => {
    const rendered = await renderEmail("admin-impersonation-notice", {
      recipientFirstName: "Sam",
      entityName: "Acme Gallery",
      adminDisplayName: "Alex Support",
      windowEndDisplay: "7 May 2026, 14:00",
      supportContactEmail: "support@lax.bid",
    });
    expect(rendered.subject).toBe("LAX support is reviewing your account (Acme Gallery)");
    expect(rendered.html).toContain("Acme Gallery");
    expect(rendered.html).toContain("Alex Support");
    expect(rendered.text).toContain("support@lax.bid");
  });

  it("shows the LAX Account lockup and names both companies on LAX Account mail", async () => {
    const rendered = await renderEmail("welcome", { userName: "Ada" });
    expect(rendered.html).toMatch(/https?:\/\/.+\/email\/lax-account-lockup\.png/);
    expect(rendered.html).not.toContain("lax-logo.png");
    expect(rendered.text).toContain(
      "LAX Account is provided by London Auction Xchange LTD and London Art Exchange Ltd.",
    );
  });

  it("names the company of the product the person signed up through", async () => {
    const shop = await renderEmail("verify-email", {
      verificationUrl: "https://account.lax.bid/verify",
      product: "shop",
    });
    expect(shop.text).toContain("LAX Shop is operated by London Art Exchange Ltd.");
    expect(shop.text).not.toContain("London Auction Xchange LTD");

    const bid = await renderEmail("reset-password", {
      resetLink: "https://account.lax.bid/reset",
      userEmail: "ada@example.com",
      expirationMinutes: 60,
      product: "bid",
    });
    expect(bid.text).toContain("LAX Bid is operated by London Auction Xchange LTD.");
  });

  it("names each product's own company on product mail", async () => {
    const bid = await renderEmail("bid-outbid", {
      lotTitle: "Lot 1",
      lotUrl: "https://lax.bid/lot/1",
      unsubscribeUrl: "https://lax.bid/unsubscribe",
    });
    expect(bid.text).toContain("© ");
    expect(bid.text).toContain("London Auction Xchange LTD. All rights reserved.");
    expect(bid.text).not.toContain("London Art Exchange Ltd");

    const shop = await renderEmail("shop-order-receipt", {
      orderId: "ord-1",
      totalAmount: "£100.00",
      vatAmount: "£16.67",
      orderUrl: "https://shop.lax.art/account/orders/ord-1",
      lineSummary: "Print",
    });
    expect(shop.text).toContain("London Art Exchange Ltd. All rights reserved.");
    expect(shop.text).not.toContain("London Auction Xchange LTD");
    expect(shop.html).toContain("/email/lax-shop-lockup.png");
    expect(shop.html).toContain('alt="LAX Shop"');
    expect(shop.html).not.toContain("lax-logo.png");

    const art = await renderEmail("art-general-enquiry-alert", {
      topicLabel: "Private viewing",
      buyerEmail: "ada@example.com",
      message: "Saturday?",
    });
    expect(art.text).toContain("lax.art is operated by London Art Exchange Ltd.");
  });

  it("renders payout transfer failed with fact card fields", async () => {
    const rendered = await renderEmail("payout-transfer-failed-notice", {
      recipientFirstName: "Sam",
      entityName: "Acme Ltd",
      payoutId: "po_123",
      payoutAmount: "100.00",
      payoutCurrency: "GBP",
      failureReason: "No account",
      supportContactEmail: "support@lax.bid",
      audience: "staff",
      payoutsUrl: "https://lax.bid/admin/payouts",
      sellerPayoutSetupUrl: "https://lax.bid/selling/payout-setup",
    });
    expect(rendered.html).toContain("Amount");
    expect(rendered.html).toContain("No account");
    expect(rendered.html).toContain("po_123");
    expect(rendered.html).toContain("https://lax.bid/selling/payout-setup");
  });

  it("words payout notices for the seller and never links them to the admin queue", async () => {
    const base = {
      recipientFirstName: "Sam",
      entityName: "Acme Ltd",
      payoutId: "po_123",
      supportContactEmail: "support@lax.bid",
      payoutsUrl: "https://lax.bid/selling/payouts",
      audience: "seller" as const,
    };
    const failed = await renderEmail("payout-transfer-failed-notice", {
      ...base,
      payoutAmount: "100.00",
      payoutCurrency: "GBP",
      failureReason: "account_closed: raw provider error",
      sellerPayoutSetupUrl: "https://lax.bid/selling/payout-setup",
    });
    expect(failed.subject).toBe("We could not send your payout for Acme Ltd");
    expect(failed.html).toContain("https://lax.bid/selling/payouts");
    expect(failed.html).not.toContain("raw provider error");
    expect(failed.html).not.toContain("finance team");
    expect(failed.html).not.toContain("/admin/");

    const blocked = await renderEmail("payout-transfer-blocked-notice", {
      ...base,
      payoutAmount: "100.00",
      payoutCurrency: "GBP",
      blockReason: "Connect account not ready",
    });
    expect(blocked.html).toContain("Sold &amp; payouts");
    expect(blocked.html).not.toContain("/admin/");

    const initiated = await renderEmail("payout-initiated-notice", {
      ...base,
      amount: "100.00",
      currency: "GBP",
    });
    expect(initiated.html).toContain("https://lax.bid/selling/payouts");

    const clawback = await renderEmail("payout-clawback-required-notice", {
      ...base,
      netAmount: "-20.00",
      currency: "GBP",
    });
    expect(clawback.html).toContain("https://lax.bid/selling/payouts");
    expect(clawback.html).not.toContain("manual reconciliation");
  });

  it("keeps the operational wording and admin link for the staff copy of a blocked payout", async () => {
    const rendered = await renderEmail("payout-transfer-blocked-notice", {
      audience: "staff",
      entityName: "Acme Ltd",
      payoutId: "po_123",
      payoutAmount: "100.00",
      payoutCurrency: "GBP",
      blockReason: "Connect account not ready",
      supportContactEmail: "support@lax.bid",
      payoutsUrl: "https://lax.bid/admin/payouts",
    });
    expect(rendered.subject).toBe("Payout blocked for Acme Ltd");
    expect(rendered.html).toContain("https://lax.bid/admin/payouts");
  });

  it("renders social-account-linked with provider-specific copy", async () => {
    const rendered = await renderEmail("social-account-linked", {
      provider: "google",
      userName: "Ada",
    });

    expect(rendered.subject).toBe("A sign-in method was linked to your LAX.BID account");
    expect(rendered.html).toContain("Google account linked");
    expect(rendered.text).toContain("Google account was linked");
  });

  it("renders social-account-unlinked with provider-specific copy", async () => {
    const rendered = await renderEmail("social-account-unlinked", {
      provider: "apple",
      userName: "Ada",
    });

    expect(rendered.subject).toBe("A sign-in method was disconnected from your LAX.BID account");
    expect(rendered.html).toContain("Apple account disconnected");
    expect(rendered.text).toContain("Apple account was disconnected");
  });

  it("renders the withdrawal decline notice with the staff reason", async () => {
    const rendered = await renderEmail("lot-withdrawal-declined-notice", {
      recipientFirstName: "Sam",
      lotTitle: "Harbour at Dusk",
      reason: "The lot is already in the printed catalogue.",
      supportContactEmail: "support@lax.bid",
    });
    expect(rendered.subject).toBe("Withdrawal request declined: Harbour at Dusk");
    expect(rendered.html).toContain("The lot is already in the printed catalogue.");
    expect(rendered.text).toContain("Harbour at Dusk");
  });

  it("applies category accent colours from design tokens", async () => {
    const alertHtml = (
      await renderEmail("lot-voided-notice", {
        recipientFirstName: "Sam",
        lotTitle: "Lot A",
        reason: "admin_void",
        supportContactEmail: "support@lax.bid",
      })
    ).html;
    expect(alertHtml).toContain("#e83030");

    const auctionHtml = (
      await renderEmail("bid-outbid", {
        userName: "Ada",
        lotTitle: "Untitled",
        lotUrl: "https://lax.bid/lot",
        currentBid: "GBP 1",
        unsubscribeUrl: "https://lax.bid/unsub",
      })
    ).html;
    expect(auctionHtml).toContain("#d4af37");

    const financeHtml = (
      await renderEmail("payment-receipt", {
        userName: "Ada",
        lotTitle: "Art",
        amount: "GBP 10",
        receiptUrl: null,
      })
    ).html;
    expect(financeHtml).toContain("#091f5b");
  });
});
