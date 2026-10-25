import {
  COLORS,
  FONT_STACK_BODY,
  LAX_PRODUCT_NAMES,
  type LaxBrandProduct,
  SITE_SUPPORT_EMAIL,
  SITE_TELEPHONE_DISPLAY,
  legalEntitiesFor,
  legalOperatorSentence,
  productCopyrightLine,
} from "@auction/branding";
import { Link, Section, Text } from "@react-email/components";
import { useContext } from "react";
import { EmailProductContext } from "../email-product.js";

/** Why the person receives mail from each product. */
const WHY: Readonly<Record<LaxBrandProduct, string>> = {
  bid: `${LAX_PRODUCT_NAMES.bid} sends this email because it relates to your account, bidding, payment or auction activity.`,
  shop: `${LAX_PRODUCT_NAMES.shop} sends this email because it relates to your order or your account.`,
  art: `${LAX_PRODUCT_NAMES.art} sends this email because it relates to an enquiry, a purchase or your account.`,
  account: `${LAX_PRODUCT_NAMES.account} sends this email because it relates to your account and its security.`,
};

type LegalFooterProps = {
  unsubscribeUrl?: string | null;
  /** Replaces the product's standard line on why the person gets this email. */
  reason?: string;
  /** Replaces "Unsubscribe from this notification type" for mail with its own opt-out. */
  unsubscribeLabel?: string;
  /** Defaults to the product the email is rendered for (see `emailProductFor`). */
  product?: LaxBrandProduct;
};

/** Names the company behind the product, its registered office and the copyright holder. */
export function LegalFooter({
  unsubscribeUrl,
  reason,
  unsubscribeLabel,
  product,
}: LegalFooterProps) {
  const renderedFor = useContext(EmailProductContext);
  const resolved = product ?? renderedFor;
  // Both companies share one registered office, so the first entity's address serves Account too.
  const [entity] = legalEntitiesFor(resolved);
  const registeredOffice = entity?.registeredAddress.inline.replace(/United Kingdom$/, "UK") ?? "";
  // Bid's phone line and support inbox also serve LAX Account; Shop and lax.art list theirs on their help pages.
  const contact =
    resolved === "bid" || resolved === "account"
      ? ` · ${SITE_TELEPHONE_DISPLAY} · ${SITE_SUPPORT_EMAIL}`
      : "";

  return (
    <Section style={wrap}>
      <Text style={muted}>{reason ?? WHY[resolved]}</Text>
      {unsubscribeUrl && unsubscribeLabel ? (
        <Text style={muted}>
          <Link href={unsubscribeUrl} style={link}>
            {unsubscribeLabel}
          </Link>
        </Text>
      ) : unsubscribeUrl ? (
        <Text style={muted}>
          Prefer not to receive this type of notification?{" "}
          <Link href={unsubscribeUrl} style={link}>
            Unsubscribe from this notification type
          </Link>
          .
        </Text>
      ) : null}
      <Text style={company}>
        {legalOperatorSentence(resolved)} Registered office: {registeredOffice}
        {contact}
      </Text>
      <Text style={copyright}>{productCopyrightLine(resolved)}</Text>
    </Section>
  );
}

const wrap = {
  marginTop: "32px",
};

const muted = {
  color: COLORS.textMuted,
  fontFamily: FONT_STACK_BODY,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 12px",
};

const link = {
  color: COLORS.link,
  textDecoration: "underline",
};

const company = {
  color: COLORS.textSecondary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 8px",
};

const copyright = {
  color: COLORS.textMuted,
  fontFamily: FONT_STACK_BODY,
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
};
