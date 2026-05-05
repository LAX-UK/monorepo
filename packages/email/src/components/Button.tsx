import { Link } from "@react-email/components";
import type { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
};

export function Button({ href, children }: ButtonProps) {
  return (
    <Link href={href} style={button}>
      {children}
    </Link>
  );
}

const button = {
  backgroundColor: "#6f4e37",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "bold",
  margin: "16px 0",
  padding: "12px 18px",
  textDecoration: "none",
};
