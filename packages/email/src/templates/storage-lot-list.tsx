import { COLORS, FONT_STACK_BODY } from "@auction/branding";

const list = {
  color: COLORS.textPrimary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 14px",
  paddingLeft: "20px",
};

const note = {
  color: COLORS.textSecondary,
  display: "block",
  fontSize: "14px",
  lineHeight: "22px",
};

/**
 * The works a storage email is about, one per line, each with its storage note under it when it
 * has one (its rate after the free period, or its running total). `notes` follows `lots` by index.
 */
export function StorageLotList({
  lots,
  notes,
}: {
  lots: readonly string[];
  notes: readonly (string | null | undefined)[];
}) {
  return (
    <ul style={list}>
      {lots.map((lot, index) => {
        const text = notes[index];
        return (
          <li key={lot}>
            {lot}
            {text ? <span style={note}>{text}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
