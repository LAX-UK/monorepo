import { COLORS, FONT_STACK_HEADING } from "@auction/branding";
import { Heading as ReactEmailHeading } from "@react-email/components";

type DocumentHeadingProps = {
  children: string;
  accentColor: string;
};

export function DocumentHeading({ children, accentColor }: DocumentHeadingProps) {
  return (
    <ReactEmailHeading
      as="h1"
      style={{
        borderTop: `2px solid ${accentColor}`,
        color: COLORS.ink,
        fontFamily: FONT_STACK_HEADING,
        fontSize: "28px",
        fontWeight: 400,
        lineHeight: "36px",
        margin: "0 0 20px",
        paddingTop: "16px",
      }}
    >
      {children}
    </ReactEmailHeading>
  );
}
