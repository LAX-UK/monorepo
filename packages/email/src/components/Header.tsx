import {
  COLORS,
  EMAIL_PRODUCT_LOGOS,
  EMAIL_SITE_URL,
  type LaxBrandProduct,
} from "@auction/branding";
import { Img, Link, Section } from "@react-email/components";

/**
 * The lockup of the product that sends the email. Only Bid's links home: the hosted email
 * assets and `EMAIL_SITE_URL` belong to LAX Bid.
 */
export function Header({ product }: { product: LaxBrandProduct }) {
  const logo = EMAIL_PRODUCT_LOGOS[product];
  const image = (
    <Img
      alt={logo.alt}
      height={logo.displayHeight}
      src={logo.url}
      srcSet={`${logo.url} 1x, ${logo.url2x} 2x`}
      style={img}
      width={logo.displayWidth}
    />
  );
  return (
    <Section style={section}>
      {product === "bid" ? (
        <Link href={EMAIL_SITE_URL} style={logoLink}>
          {image}
        </Link>
      ) : (
        <div style={logoLink}>{image}</div>
      )}
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
