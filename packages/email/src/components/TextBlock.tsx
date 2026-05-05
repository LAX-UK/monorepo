import { Text } from "@react-email/components";
import type { ReactNode } from "react";

type TextBlockProps = {
  children: ReactNode;
};

export function TextBlock({ children }: TextBlockProps) {
  return <Text style={paragraph}>{children}</Text>;
}

const paragraph = {
  color: "#342c26",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 14px",
};
