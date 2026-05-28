import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("renderEmail", () => {
  it("renders auth templates to html and plaintext", async () => {
    const rendered = await renderEmail("verify-email", {
      verificationUrl: "https://lax.bid/verify",
      userName: "Ada",
    });

    expect(rendered.subject).toBe("Verify your London Art Exchange email");
    expect(rendered.html).toContain("Verify your email");
    expect(rendered.text).toContain("Confirm this email address");
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
        addressIncomplete: false,
      },
    });
    expect(rendered.subject).toBe("Payment invoice");
    expect(rendered.html).toContain("Bill to");
    expect(rendered.html).toContain("Acme Ltd");
    expect(rendered.html).toContain("VAT: GB123");
    expect(rendered.html).toMatch(/https?:\/\/.+\/email\/lax-logo\.png/);
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

  it("includes hosted logo URL and legal name in rendered HTML", async () => {
    const rendered = await renderEmail("welcome", { userName: "Ada" });
    expect(rendered.html).toMatch(/https?:\/\/.+\/email\/lax-logo\.png/);
    expect(rendered.html).toContain("London Auction Xchange LTD");
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
      adminPayoutsUrl: "https://lax.bid/admin/payouts",
      sellerPayoutSetupUrl: "https://lax.bid/dashboard/seller/connect",
    });
    expect(rendered.html).toContain("Amount");
    expect(rendered.html).toContain("No account");
    expect(rendered.html).toContain("po_123");
    expect(rendered.html).toContain("https://lax.bid/dashboard/seller/connect");
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
