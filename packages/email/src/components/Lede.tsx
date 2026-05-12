import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import { Text } from "@react-email/components";
import type { ReactNode } from "react";

type LedeProps = {
  children: ReactNode;
};

export function Lede({ children }: LedeProps) {
  return <Text style={lede}>{children}</Text>;
}

const lede = {
  color: COLORS.textPrimary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "17px",
  fontWeight: 500,
  lineHeight: "26px",
  margin: "0 0 14px",
};
