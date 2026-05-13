import { type EmailCategory, FONT_STACK_BODY, categoryAccentColor } from "@auction/branding";
import { Section, Text } from "@react-email/components";

type EyebrowProps = {
  label: string;
  category: EmailCategory;
};

export function Eyebrow({ label, category }: EyebrowProps) {
  const accent = categoryAccentColor(category);
  return (
    <Section style={wrap}>
      <Text style={{ ...text, color: accent, fontFamily: FONT_STACK_BODY }}>
        <span
          aria-hidden
          style={{
            ...dot,
            backgroundColor: accent,
          }}
        />
        {label}
      </Text>
    </Section>
  );
}

const wrap = {
  margin: "0 0 12px",
};

const text = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.16em",
  lineHeight: "16px",
  margin: 0,
  textTransform: "uppercase" as const,
};

const dot = {
  borderRadius: "4px",
  display: "inline-block",
  height: "8px",
  marginRight: "8px",
  verticalAlign: "middle",
  width: "8px",
};
