import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import {
  SHOP_IDENTITY_ID_TOKEN_COOKIE,
  SHOP_IDENTITY_SESSION_COOKIE,
} from "@/lib/shop-identity.server";
import { SHOP_SILENT_SSO_COOKIE_PREFIX } from "@/lib/silent-sign-in/config";
import { SHOP_THEME_COOKIE } from "@/lib/theme/shop-theme";
import { legalEntityFor } from "@auction/branding";
import { createSilentSignInCookieSpec } from "@auction/identity-rp";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { SHOP_BASKET_COOKIE, SHOP_COMMERCE_CSRF_COOKIE } from "@auction/shop-portal/bff";
import { describe, expect, it } from "vitest";
import { SHOP_POLICY_DOCUMENTS, SHOP_POLICY_PATHS, SHOP_POLICY_RELEASES } from "./index";
import { parseShopPolicyText, shopPolicyPlaceholders, shopPolicyTexts } from "./shop-policy-text";

const documents = Object.values(SHOP_POLICY_DOCUMENTS);
const knownPaths = new Set([...Object.values(SHOP_POLICY_PATHS), SHOP_ORDERS_HREF]);

function pageText(slug: keyof typeof SHOP_POLICY_DOCUMENTS): string {
  return shopPolicyTexts(SHOP_POLICY_DOCUMENTS[slug]).join("\n");
}

describe("Shop policy documents", () => {
  it("cannot be approved while a placeholder is left", () => {
    for (const document of documents) {
      if (SHOP_POLICY_RELEASES[document.slug].status === "approved") {
        expect(shopPolicyPlaceholders(document), document.slug).toEqual([]);
      }
    }
  });

  it("uses unique, url-safe section anchors", () => {
    for (const document of documents) {
      const ids = document.sections.map((section) => section.id);
      expect(new Set(ids).size, document.slug).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  it("links only to Shop routes and to sections that exist", () => {
    const anchors = new Map(
      documents.map((document) => [
        SHOP_POLICY_PATHS[document.slug],
        new Set(document.sections.map((section) => section.id)),
      ]),
    );
    for (const document of documents) {
      const ownPath = SHOP_POLICY_PATHS[document.slug];
      for (const text of shopPolicyTexts(document)) {
        for (const part of parseShopPolicyText(text)) {
          if (part.kind !== "link" || part.href.startsWith("https://")) continue;
          const [path = "", hash] = part.href.split("#");
          const target = path === "" ? ownPath : path;
          expect(knownPaths.has(target), `${document.slug}: ${part.href}`).toBe(true);
          if (hash) {
            expect(anchors.get(target)?.has(hash), `${document.slug}: ${part.href}`).toBe(true);
          }
        }
      }
    }
  });

  it("names the seller and marks every unconfirmed company detail", () => {
    const terms = pageText("terms");
    expect(terms).toContain("London Art Exchange Ltd");
    expect(terms).toContain(legalEntityFor("shop").registeredAddress.inline);
    expect(terms).not.toContain("London Auction Xchange");
    for (const detail of [
      "London Art Exchange Ltd company number",
      "London Art Exchange Ltd VAT registration number",
      "Shop customer service email address",
    ]) {
      expect(shopPolicyPlaceholders(SHOP_POLICY_DOCUMENTS.terms)).toContain(detail);
    }
  });

  it("covers the cancellation information buyers must be given", () => {
    const returns = pageText("returns");
    expect(returns).toMatch(/14 days/);
    expect(returns).toMatch(/Report a problem/);
    expect(returns).toMatch(/refund you within \*\*14 days\*\*/);
    expect(returns).toMatch(/Return postage/);
    expect(returns).toMatch(/certificate of authenticity/i);
    expect(returns).toMatch(/edition number/i);
    expect(returns).toMatch(/damaged or faulty/i);
    expect(returns).toMatch(/hereby give notice that I\/We\* cancel/);
    expect(SHOP_POLICY_DOCUMENTS.returns.sections.map((section) => section.id)).toContain(
      "cancellation-form",
    );
  });

  it("quotes the delivery and storage prices checkout charges", () => {
    const delivery = pageText("delivery");
    const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
    expect(delivery).toContain(
      `${pounds(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery)} per order`,
    );
    expect(delivery).toContain(pounds(FULFILMENT_SURCHARGE_PENCE.lax_storage));
  });

  it("uses shopper words, not operations words", () => {
    for (const document of documents) {
      const text = shopPolicyTexts(document).join("\n").toLowerCase();
      for (const word of ["fulfilment", "surcharge", "committed", "unprinted"]) {
        expect(text, `${document.slug}: ${word}`).not.toContain(word);
      }
    }
  });

  it("lists every cookie Shop sets in the cookie policy", () => {
    const policy = pageText("cookies");
    for (const name of [
      SHOP_IDENTITY_SESSION_COOKIE,
      SHOP_IDENTITY_ID_TOKEN_COOKIE,
      SHOP_BASKET_COOKIE,
      SHOP_COMMERCE_CSRF_COOKIE,
      SHOP_THEME_COOKIE,
      ...Object.values(createSilentSignInCookieSpec(SHOP_SILENT_SSO_COOKIE_PREFIX)),
    ]) {
      expect(policy, name).toContain(name);
    }
  });

  it("names London Art Exchange Ltd as controller in the privacy notice", () => {
    expect(pageText("privacy")).toContain(
      `For the personal data described here, ${legalEntityFor("shop").name} is the controller.`,
    );
  });
});
