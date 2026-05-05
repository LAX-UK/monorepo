import { Body, Container, Head, Heading, Html, Preview, Section } from "@react-email/components";
import type { ReactNode } from "react";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";

type LayoutProps = {
  preview: string;
  title: string;
  children: ReactNode;
};

export function Layout({ preview, title, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brand}>
            <Header />
          </Section>
          <Heading style={heading}>{title}</Heading>
          {children}
          <Footer />
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f7f4ef",
  color: "#1f1a17",
  fontFamily: "Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5ded4",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px",
};

const brand = {
  marginBottom: "24px",
};

const heading = {
  color: "#1f1a17",
  fontSize: "24px",
  lineHeight: "32px",
  margin: "0 0 20px",
};
