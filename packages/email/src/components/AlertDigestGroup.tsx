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
              {item.imageUrl ? (
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
