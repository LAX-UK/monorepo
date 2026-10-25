import { COLORS, FONT_STACK_BODY } from "@auction/branding";
import { Section, Text } from "@react-email/components";

type EyebrowProps = {
  label: string;
  /** The sending product's accent (see `emailAccentColor`). */
  accentColor: string;
};

/** A short sentence-case label above the title, marked with the product's accent dot. */
export function Eyebrow({ label, accentColor }: EyebrowProps) {
  return (
    <Section style={wrap}>
      {/* The dot carries the accent; the label stays at text contrast. */}
      <Text style={{ ...text, color: COLORS.textSecondary, fontFamily: FONT_STACK_BODY }}>
        <span aria-hidden style={{ ...dot, backgroundColor: accentColor }} />
        {label}
      </Text>
    </Section>
  );
}

const wrap = {
  margin: "0 0 12px",
};

const text = {
  fontSize: "14px",
  fontWeight: 500,
  lineHeight: "20px",
  margin: 0,
};

const dot = {
  borderRadius: "4px",
  display: "inline-block",
  height: "8px",
  marginRight: "8px",
  verticalAlign: "middle",
  width: "8px",
};
