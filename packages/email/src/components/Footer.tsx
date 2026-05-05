import { Hr, Text } from "@react-email/components";

export function Footer() {
  return (
    <>
      <Hr style={rule} />
      <Text style={footer}>
        London Art Exchange sends this email because it relates to your account, bidding, payment,
        or auction activity.
      </Text>
    </>
  );
}

const rule = {
  borderColor: "#e5ded4",
  margin: "32px 0 16px",
};

const footer = {
  color: "#766b63",
  fontSize: "12px",
  lineHeight: "18px",
};
