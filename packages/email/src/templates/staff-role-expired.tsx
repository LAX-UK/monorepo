import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["staff-role-expired"];

export const subject = (vars: Vars) =>
  vars.recipient === "person"
    ? `Your ${vars.roleLabel} role has ended`
    : `A staff role has ended: ${vars.staffName}`;

export default function StaffRoleExpiredEmail(vars: Vars) {
  const { recipient, recipientFirstName, staffName, roleLabel, endedOnDisplay } = vars;
  const product = vars.productLabel ?? "Bid";
  const greeting = recipientFirstName ? `${recipientFirstName}, ` : "";

  return (
    <Layout
      category="alert"
      eyebrow={`${product} · staff access`}
      preview={
        recipient === "person"
          ? `Your ${roleLabel} role ended on ${endedOnDisplay}`
          : `${staffName}'s ${roleLabel} role ended on ${endedOnDisplay}`
      }
      title={recipient === "person" ? "Your staff role has ended" : "A staff role has ended"}
    >
      {recipient === "person" ? (
        <TextBlock>
          {greeting}your {roleLabel} role on {product} ended on {endedOnDisplay}. Ask an
          administrator if you still need it.
        </TextBlock>
      ) : (
        <TextBlock>
          {greeting}a staff role on {product} reached its end date and has been recorded as ended.
        </TextBlock>
      )}
      <FactCard
        rows={[
          { label: "Person", value: recipient === "administrator" ? staffName : undefined },
          { label: "Role", value: roleLabel },
          { label: "Ended on", value: endedOnDisplay },
        ]}
      />
      {recipient === "administrator" && vars.adminStaffAccessUrl ? (
        <TextBlock>
          <Link
            href={vars.adminStaffAccessUrl}
            style={{ color: COLORS.link, textDecoration: "underline" }}
          >
            Review staff access
          </Link>
        </TextBlock>
      ) : null}
    </Layout>
  );
}
