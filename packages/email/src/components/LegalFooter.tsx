import {
  COLORS,
  FONT_STACK_BODY,
  SITE_BUSINESS_ADDRESS_INLINE,
  SITE_COMPANY_NAME,
  SITE_SUPPORT_EMAIL,
  SITE_TELEPHONE_DISPLAY,
  siteCopyrightLine,
} from "@auction/branding";
import { Link, Section, Text } from "@react-email/components";

const WHY_ALL =
  "London Art Exchange sends this email because it relates to your account, bidding, payment, or auction activity.";

type LegalFooterProps = {
  unsubscribeUrl?: string | null;
};

export function LegalFooter({ unsubscribeUrl }: LegalFooterProps) {
  const addressLine = SITE_BUSINESS_ADDRESS_INLINE.replace("United Kingdom.", "UK").replace(
    /\.\s*$/,
    "",
  );
  const companyLine = `${SITE_COMPANY_NAME} · ${addressLine} · ${SITE_TELEPHONE_DISPLAY} · ${SITE_SUPPORT_EMAIL}`;

  return (
    <Section style={wrap}>
      <Text style={muted}>{WHY_ALL}</Text>
      {unsubscribeUrl ? (
        <Text style={muted}>
          Prefer not to receive this type of auction notification?{" "}
          <Link href={unsubscribeUrl} style={link}>
            Unsubscribe from this notification type
          </Link>
          .
        </Text>
      ) : null}
      <Text style={company}>{companyLine}</Text>
      <Text style={copyright}>{siteCopyrightLine()}</Text>
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
  fontSize: "11px",
  lineHeight: "16px",
  margin: 0,
};
