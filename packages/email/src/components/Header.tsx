import { Text } from "@react-email/components";

export function Header() {
  return <Text style={brandText}>London Art Exchange</Text>;
}

const brandText = {
  color: "#6f4e37",
  fontSize: "13px",
  fontWeight: "bold",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};
