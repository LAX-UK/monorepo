import { COLORS, FONT_STACK_BODY, SITE_SUPPORT_EMAIL } from "@auction/branding";
import { Link, Text } from "@react-email/components";

type HelpBlockProps = {
  /** Defaults to `SITE_SUPPORT_EMAIL` */
  email?: string;
};

export function HelpBlock({ email = SITE_SUPPORT_EMAIL }: HelpBlockProps) {
  return (
    <Text style={help}>
      If you have questions, contact{" "}
      <Link href={`mailto:${email}`} style={link}>
        {email}
      </Link>
      .
    </Text>
  );
}

const help = {
  color: COLORS.textSecondary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "16px 0 0",
};

const link = {
  color: COLORS.link,
  textDecoration: "underline",
};
