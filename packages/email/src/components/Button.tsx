import { COLORS, EMAIL_RADIUS_PX, FONT_STACK_BODY } from "@auction/branding";
import { Button as EmailButton } from "@react-email/components";
import type { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
  tone?: "primary" | "subtle";
};

export function Button({ href, children, tone = "primary" }: ButtonProps) {
  const isPrimary = tone === "primary";
  return (
    <EmailButton
      href={href}
      style={{
        backgroundColor: isPrimary ? COLORS.ctaBg : COLORS.surface,
        border: isPrimary ? "none" : `1px solid ${COLORS.border}`,
        borderRadius: `${EMAIL_RADIUS_PX}px`,
        boxSizing: "border-box" as const,
        color: isPrimary ? COLORS.ctaOn : COLORS.textPrimary,
        display: "inline-block",
        fontFamily: FONT_STACK_BODY,
        fontSize: "14px",
        fontWeight: 700,
        lineHeight: "20px",
        margin: "16px 0",
        padding: "12px 20px",
        textDecoration: "none",
      }}
    >
      {children}
    </EmailButton>
  );
}
