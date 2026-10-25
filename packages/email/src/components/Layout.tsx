import {
  COLORS,
  EMAIL_RADIUS_PX,
  type EmailCategory,
  FONT_STACK_BODY,
  type LaxBrandProduct,
  emailAccentColor,
} from "@auction/branding";
import { Body, Container, Head, Html, Preview, Section } from "@react-email/components";
import { type ReactNode, useContext } from "react";
import { EmailProductContext } from "../email-product.js";
import { AccountHeader } from "./AccountHeader.js";
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
  /** Footer overrides for mail that is not about an order or an account, e.g. edition alerts. */
  footerReason?: string;
  unsubscribeLabel?: string;
  /** `account` uses the left-aligned LAX Account lockup for security notices. */
  header?: "wordmark" | "account";
  /** Product the email belongs to; defaults to the one `renderEmail` resolves for the template. */
  product?: LaxBrandProduct;
  children: ReactNode;
};

export function Layout({
  preview,
  eyebrow,
  category,
  title,
  unsubscribeUrl,
  footerReason,
  unsubscribeLabel,
  header = "wordmark",
  product,
  children,
}: LayoutProps) {
  const renderedFor = useContext(EmailProductContext);
  const resolvedProduct = product ?? renderedFor;
  const accent = emailAccentColor(resolvedProduct, category);

  return (
    <Html lang="en">
      <Head>
        <title>{title}</title>
        <meta content="light" name="color-scheme" />
        <meta content="light" name="supported-color-schemes" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={inner}>
            {header === "account" ? <AccountHeader /> : <Header product={resolvedProduct} />}
            <Eyebrow accentColor={accent} label={eyebrow} />
            <DocumentHeading accentColor={accent}>{title}</DocumentHeading>
            {children}
            <LegalFooter
              {...(unsubscribeUrl != null ? { unsubscribeUrl } : {})}
              {...(footerReason ? { reason: footerReason } : {})}
              {...(unsubscribeLabel ? { unsubscribeLabel } : {})}
              product={resolvedProduct}
            />
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
