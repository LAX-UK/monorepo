import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import { Text } from "@react-email/components";
import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { FactCard, type FactCardRow } from "./FactCard.js";
import { Layout } from "./Layout.js";
import { TextBlock } from "./TextBlock.js";

export type SecurityNoticeProps = {
  preview: string;
  title: string;
  userName?: string | null | undefined;
  /** What happened, in plain sentences. */
  children: ReactNode;
  /** Europe/London time, already formatted by the sender. */
  whenDisplay: string;
  /** Browser and system label such as "Chrome on macOS"; omitted when the request had no user agent. */
  deviceLabel?: string | null | undefined;
  /** Rows shown above "When" and "Device", for example the old and new email address. */
  details?: FactCardRow[];
  /** LAX Account security page, where the person can sign out everywhere and change their password. */
  secureAccountUrl: string;
};

/**
 * The one shape every LAX Account security email shares: what happened, when, on which device,
 * and a way to secure the account if it was not them. Keeping it in one place means a reader
 * learns where to look, and no notice can ship without the "this wasn't me" route.
 */
export function SecurityNotice({
  preview,
  title,
  userName,
  children,
  whenDisplay,
  deviceLabel,
  details = [],
  secureAccountUrl,
}: SecurityNoticeProps) {
  return (
    <Layout category="account" eyebrow="Security" header="account" preview={preview} title={title}>
      <TextBlock>Hi {userName || "there"},</TextBlock>
      {children}
      <FactCard
        rows={[
          ...details,
          { label: "When", value: whenDisplay },
          { label: "Device", value: deviceLabel },
        ]}
      />
      <Text style={subheading}>If this wasn't you</Text>
      <TextBlock>
        Secure your account straight away. You can sign out everywhere and change your password from
        your LAX Account security page.
      </TextBlock>
      <Button href={secureAccountUrl}>Secure your account</Button>
      <TextBlock>If this was you, there's nothing more to do.</TextBlock>
    </Layout>
  );
}

const subheading = {
  color: COLORS.ink,
  fontFamily: FONT_STACK_BODY,
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: "20px 0 6px",
};
