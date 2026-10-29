import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["staff-role-changed"];

function verb(change: Vars["change"]): string {
  return change === "given" ? "given" : "removed";
}

export const subject = (vars: Vars) =>
  vars.recipient === "person"
    ? vars.change === "given"
      ? `You have a new ${vars.productLabel} role: ${vars.roleLabel}`
      : `Your ${vars.productLabel} ${vars.roleLabel} role was removed`
    : `A ${vars.productLabel} role was ${verb(vars.change)}: ${vars.staffName}`;

export default function StaffRoleChangedEmail(vars: Vars) {
  const { recipient, recipientFirstName, staffName, roleLabel, productLabel, change } = vars;
  const greeting = recipientFirstName ? `${recipientFirstName}, ` : "";
  const by = vars.changedByName ? ` by ${vars.changedByName}` : "";

  return (
    <Layout
      category="alert"
      eyebrow={`${productLabel} · staff access`}
      preview={
        recipient === "person"
          ? `Your ${roleLabel} role was ${verb(change)}${by}`
          : `${staffName}'s ${roleLabel} role was ${verb(change)}${by}`
      }
      title={change === "given" ? "A staff role was given" : "A staff role was removed"}
    >
      {recipient === "person" ? (
        <TextBlock>
          {greeting}
          {change === "given"
            ? `you were given the ${roleLabel} role on ${productLabel}${by}. It applies the next time you load a page.`
            : `your ${roleLabel} role on ${productLabel} was removed${by}. Ask an administrator if you still need it.`}
        </TextBlock>
      ) : (
        <TextBlock>
          {greeting}
          {change === "given"
            ? `${staffName} was given the ${roleLabel} role on ${productLabel}${by}.`
            : `${staffName}'s ${roleLabel} role on ${productLabel} was removed${by}.`}
        </TextBlock>
      )}
      <FactCard
        rows={[
          { label: "Person", value: recipient === "administrator" ? staffName : undefined },
          { label: "Role", value: roleLabel },
          {
            label: "Until",
            value: change === "given" ? (vars.endsOnDisplay ?? undefined) : undefined,
          },
          { label: "Reason", value: vars.reason ?? undefined },
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
