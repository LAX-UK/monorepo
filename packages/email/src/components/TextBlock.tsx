import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import { Text } from "@react-email/components";
import type { ReactNode } from "react";

type TextBlockProps = {
  children: ReactNode;
};

export function TextBlock({ children }: TextBlockProps) {
  return <Text style={paragraph}>{children}</Text>;
}

const paragraph = {
  color: COLORS.textPrimary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 14px",
};
