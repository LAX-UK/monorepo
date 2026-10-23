import {
  COLORS,
  EMAIL_ACCOUNT_LOCKUP_ALT,
  EMAIL_ACCOUNT_LOCKUP_DISPLAY_HEIGHT,
  EMAIL_ACCOUNT_LOCKUP_DISPLAY_WIDTH,
  EMAIL_ACCOUNT_LOCKUP_URL,
  EMAIL_ACCOUNT_LOCKUP_URL_2X,
} from "@auction/branding";
import { Img, Section } from "@react-email/components";

/**
 * Header for mail sent by LAX Account: the Account lockup instead of the London Art Exchange
 * wordmark, because a security notice comes from the account, not from one product. It is not
 * a link, so the only link a reader is steered towards is the one to secure the account.
 */
export function AccountHeader() {
  return (
    <Section style={section}>
      <Img
        alt={EMAIL_ACCOUNT_LOCKUP_ALT}
        height={EMAIL_ACCOUNT_LOCKUP_DISPLAY_HEIGHT}
        src={EMAIL_ACCOUNT_LOCKUP_URL}
        srcSet={`${EMAIL_ACCOUNT_LOCKUP_URL} 1x, ${EMAIL_ACCOUNT_LOCKUP_URL_2X} 2x`}
        style={img}
        width={EMAIL_ACCOUNT_LOCKUP_DISPLAY_WIDTH}
      />
      <div style={rule} />
    </Section>
  );
}

const section = {
  margin: "0 0 8px",
  textAlign: "left" as const,
};

const img = {
  border: 0,
  display: "block",
  height: "auto",
  maxWidth: "100%",
  outline: "none",
};

const rule = {
  backgroundColor: COLORS.border,
  height: "1px",
  margin: "16px 0 0",
  width: "100%",
};
