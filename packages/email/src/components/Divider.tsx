import { COLORS } from "@auction/branding";
import { Hr } from "@react-email/components";

export function Divider() {
  return <Hr style={hr} />;
}

const hr = {
  borderColor: COLORS.borderSoft,
  borderStyle: "solid",
  borderWidth: "1px 0 0",
  margin: "24px 0",
};
