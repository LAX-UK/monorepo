import {
  COLORS,
  EMAIL_RADIUS_PX,
  type EmailCategory,
  FONT_STACK_BODY,
  categoryAccentColor,
} from "@auction/branding";
import { Body, Container, Head, Html, Preview, Section } from "@react-email/components";
import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow.js";
import { Header } from "./Header.js";
import { DocumentHeading } from "./Heading.js";
import { LegalFooter } from "./LegalFooter.js";

export type LayoutProps = {
  preview: string;
  eyebrow: string;
  category: EmailCategory;
  title: string;
  unsubscribeUrl?: string | null;
  children: ReactNode;
};

export function Layout({
  preview,
  eyebrow,
  category,
  title,
  unsubscribeUrl,
  children,
}: LayoutProps) {
  const accent = categoryAccentColor(category);

  return (
    <Html lang="en">
      <Head>
        <meta content="light" name="color-scheme" />
        <meta content="light" name="supported-color-schemes" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={inner}>
            <Header />
            <Eyebrow category={category} label={eyebrow} />
            <DocumentHeading accentColor={accent}>{title}</DocumentHeading>
            {children}
            <LegalFooter {...(unsubscribeUrl != null ? { unsubscribeUrl } : {})} />
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: COLORS.paper,
  color: COLORS.textPrimary,
  fontFamily: FONT_STACK_BODY,
  margin: 0,
  padding: "32px 16px",
};

const container = {
  margin: "0 auto",
  maxWidth: "600px",
};

const inner = {
  backgroundColor: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: `${EMAIL_RADIUS_PX}px`,
  padding: "32px",
};
