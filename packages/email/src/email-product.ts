import type { LaxBrandProduct } from "@auction/branding";
import { createContext } from "react";
import { authTemplates } from "./templates/types/auth.js";
import type { EmailProductVars } from "./templates/types/shared.js";
import { shopTemplates } from "./templates/types/shop.js";
import type { TemplateName, TemplateVarsByName } from "./types.js";

/**
 * The product an email belongs to decides which company the footer names. LAX Account mail
 * names both companies unless the sender knows the product the person is acting in.
 */
export const EmailProductContext = createContext<LaxBrandProduct>("account");

const ACCOUNT_TEMPLATES: ReadonlySet<string> = new Set(authTemplates.names);
/** lax.art mail: London Art Exchange's gallery, named as lax.art in the footer. */
const ART_TEMPLATES: ReadonlySet<string> = new Set([
  "art-general-enquiry-alert",
  "art-artist-application-received",
  "art-artist-application-more-info",
  "art-artist-application-declined",
  "art-artist-application-welcome",
] satisfies TemplateName[]);
const SHOP_TEMPLATES: ReadonlySet<string> = new Set(shopTemplates.names);

/** Every template that is neither LAX Account nor Shop/lax.art mail is sent by LAX Bid. */
export function emailProductFor<T extends TemplateName>(
  template: T,
  vars: TemplateVarsByName[T],
): LaxBrandProduct {
  if (ACCOUNT_TEMPLATES.has(template)) {
    return (vars as EmailProductVars).product ?? "account";
  }
  if (ART_TEMPLATES.has(template)) return "art";
  if (template === "shop-artwork-enquiry-alert") {
    return (vars as TemplateVarsByName["shop-artwork-enquiry-alert"]).storefront === "art"
      ? "art"
      : "shop";
  }
  // The sender's copy names the storefront the enquiry was sent on.
  if (template === "art-enquiry-received") {
    return (vars as TemplateVarsByName["art-enquiry-received"]).storefront === "shop"
      ? "shop"
      : "art";
  }
  if (SHOP_TEMPLATES.has(template)) return "shop";
  return "bid";
}
