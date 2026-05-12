import { COLORS, EMAIL_RADIUS_PX, FONT_STACK_BODY } from "@auction/branding";
import { Section } from "@react-email/components";
import type { ReactNode } from "react";

export type FactCardRow = {
  label: string;
  value: ReactNode;
  /** Use monospace for IDs / references */
  mono?: boolean;
};

type FactCardProps = {
  rows: FactCardRow[];
};

const monoStack = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

export function FactCard({ rows }: FactCardProps) {
  const visible = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== "");
  if (visible.length === 0) return null;

  return (
    <Section style={card}>
      <table
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{
          borderCollapse: "collapse" as const,
          width: "100%",
        }}
      >
        <tbody>
          {visible.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  borderBottom: `1px solid ${COLORS.borderSoft}`,
                  color: COLORS.textMuted,
                  fontFamily: FONT_STACK_BODY,
                  fontSize: "12px",
                  fontWeight: 600,
                  lineHeight: "18px",
                  padding: "10px 12px 10px 0",
                  verticalAlign: "top",
                  width: "36%",
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  borderBottom: `1px solid ${COLORS.borderSoft}`,
                  color: COLORS.textPrimary,
                  fontFamily: row.mono ? monoStack : FONT_STACK_BODY,
                  fontSize: "14px",
                  lineHeight: "22px",
                  padding: "10px 0",
                  verticalAlign: "top",
                }}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

const card = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: `${EMAIL_RADIUS_PX}px`,
  margin: "16px 0",
  overflow: "hidden" as const,
};
