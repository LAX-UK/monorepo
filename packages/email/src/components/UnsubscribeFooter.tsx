import { Link, Text } from "@react-email/components";

type UnsubscribeFooterProps = {
  unsubscribeUrl: string;
};

export function UnsubscribeFooter({ unsubscribeUrl }: UnsubscribeFooterProps) {
  return (
    <Text style={unsubscribe}>
      Prefer not to receive this type of auction notification?{" "}
      <Link href={unsubscribeUrl} style={link}>
        Unsubscribe from this notification type
      </Link>
      .
    </Text>
  );
}

const unsubscribe = {
  color: "#766b63",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "24px 0 0",
};

const link = {
  color: "#6f4e37",
};
