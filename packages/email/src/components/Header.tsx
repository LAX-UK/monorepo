import {
  COLORS,
  EMAIL_LOGO_ALT,
  EMAIL_LOGO_DISPLAY_WIDTH,
  EMAIL_LOGO_URL,
  EMAIL_SITE_URL,
} from "@auction/branding";
import { Img, Link, Section } from "@react-email/components";

const displayHeight = Math.round((140 * EMAIL_LOGO_DISPLAY_WIDTH) / 480);

export function Header() {
  return (
    <Section style={section}>
      <Link href={EMAIL_SITE_URL} style={logoLink}>
        <Img
          alt={EMAIL_LOGO_ALT}
          height={displayHeight}
          src={EMAIL_LOGO_URL}
          style={img}
          width={EMAIL_LOGO_DISPLAY_WIDTH}
        />
      </Link>
      <div style={goldRule} />
    </Section>
  );
}

const section = {
  margin: "0 0 8px",
  textAlign: "center" as const,
};

const logoLink = {
  display: "inline-block",
  textDecoration: "none",
};

const img = {
  border: 0,
  display: "block",
  height: "auto",
  margin: "0 auto",
  maxWidth: "100%",
  outline: "none",
};

const goldRule = {
  backgroundColor: COLORS.gold,
  height: "2px",
  margin: "16px auto 0",
  maxWidth: "120px",
  width: "100%",
};
