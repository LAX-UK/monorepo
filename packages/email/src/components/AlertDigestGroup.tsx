import { COLORS, FONT_STACK_BODY, FONT_STACK_HEADING } from "@auction/branding";
import { Heading, Img, Link, Section, Text } from "@react-email/components";
import type { AlertDigestGroup as Group } from "../templates/types/sale-alerts.js";
import { MomentValue } from "./MomentValue.js";

/** One topic of a digest: its heading, the items under it, and a link to all when some are left out. */
export function AlertDigestGroup({
  group,
  showHeading = true,
}: {
  group: Group;
  /** False when the group is the whole email: its heading would only repeat the title. */
  showHeading?: boolean;
}) {
  return (
    <Section style={wrap}>
      {showHeading ? (
        <Heading as="h2" style={heading}>
          {group.heading}
        </Heading>
      ) : null}
      {group.subgroups.map((sub, i) => (
        <Section key={sub.label ?? `items-${i}`} style={subgroup}>
          {sub.label ? <Text style={label}>{sub.label}</Text> : null}
          {sub.criteria ? <Text style={criteria}>{sub.criteria}</Text> : null}
          {sub.items.map((item) => (
            <Section key={item.url} style={itemBox}>
              {item.imageUrl && item.imageAlt ? (
                <Link href={item.url} style={coverLink}>
                  <Img
                    alt={item.imageAlt}
                    src={item.imageUrl}
                    style={cover}
                    width={COVER_WIDTH_PX}
                  />
                </Link>
              ) : item.imageUrl ? (
                <Img alt="" height={72} src={item.imageUrl} style={thumb} width={72} />
              ) : null}
              <Link href={item.url} style={itemTitle}>
                {item.title}
              </Link>
              {item.subtitle ? <Text style={itemLine}>{item.subtitle}</Text> : null}
              {item.moments?.map((entry) => (
                <Text key={entry.label} style={itemLine}>
                  {entry.label} <MomentValue moment={entry.moment} />
                </Text>
              ))}
              {item.detail ? <Text style={itemLine}>{item.detail}</Text> : null}
            </Section>
          ))}
        </Section>
      ))}
      {group.more ? (
        <Text style={more}>
          <Link href={group.more.url} style={moreLink}>
            {group.more.label}
          </Link>
        </Text>
      ) : null}
    </Section>
  );
}

/**
 * The cover's width: the inside of the email's card (600, less its border and 32 padding each
 * side), less the cover's own 1px border each side.
 */
const COVER_WIDTH_PX = 532;

/**
 * A cover is a link to the item, scales down on narrow screens, and sits on a paper-coloured
 * block so a picture that fails to load, or is darkened by a mail app's dark mode, still reads as
 * a framed picture with its alt text rather than a hole.
 */
const coverLink = { display: "block", margin: "0 0 10px", textDecoration: "none" };
const cover = {
  backgroundColor: COLORS.paper,
  border: `1px solid ${COLORS.border}`,
  borderRadius: "4px",
  color: COLORS.textSecondary,
  display: "block",
  fontFamily: FONT_STACK_BODY,
  fontSize: "13px",
  height: "auto",
  maxWidth: "100%",
  width: `${COVER_WIDTH_PX}px`,
};
const wrap = { margin: "8px 0 20px" };
const heading = {
  color: COLORS.ink,
  fontFamily: FONT_STACK_HEADING,
  fontSize: "18px",
  fontWeight: 600,
  lineHeight: "26px",
  margin: "0 0 8px",
};
const subgroup = { margin: "0 0 8px" };
const label = {
  color: COLORS.textPrimary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "20px",
  margin: "0",
};
const criteria = {
  color: COLORS.textSecondary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 4px",
};
const itemBox = { borderTop: `1px solid ${COLORS.border}`, padding: "12px 0" };
const thumb = { borderRadius: "4px", display: "block", margin: "0 0 8px" };
const itemTitle = {
  color: COLORS.link,
  fontFamily: FONT_STACK_BODY,
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "22px",
  textDecoration: "underline",
};
const itemLine = {
  color: COLORS.textSecondary,
  fontFamily: FONT_STACK_BODY,
  fontSize: "14px",
  lineHeight: "20px",
  margin: "2px 0 0",
};
const more = { margin: "4px 0 0" };
const moreLink = {
  color: COLORS.link,
  fontFamily: FONT_STACK_BODY,
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "underline",
};
