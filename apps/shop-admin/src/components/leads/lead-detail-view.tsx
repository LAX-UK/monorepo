import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { LeadActions } from "@/components/leads/lead-actions.client";
import {
  buildLeadTimeline,
  leadConsentLine,
  leadName,
  presentLeadCrm,
  presentLeadStatus,
} from "@/server/domain/lead-list.vm";
import { ORDER_STATUS_LABELS, orderNumber } from "@/server/domain/order-list.vm";
import type {
  AdminGuestErasureState,
  AdminLeadDetail,
  AdminOrderStatus,
} from "@auction/shop-contracts";
import { GUEST_LEAD_SOURCE_LABEL } from "@auction/shop-domain";
import {
  KeyValueList,
  MetaItem,
  PageHeader,
  Section,
  StaffDate,
  StatusBadge,
  Timeline,
  formatGbp,
  formatStaffDate,
} from "@auction/staff-ui";
import Link from "next/link";

const linkClass =
  "staff-focus rounded-staff-xs font-medium text-staff-fg underline decoration-staff-line-strong underline-offset-4 hover:decoration-staff-fg";

/**
 * One guest lead: who they are, what they agreed to, where they are in the CRM, and every order
 * and enquiry they sent. Main column for their history, side column for reference.
 */
export function LeadDetailView({
  lead,
  crmUrl,
  erasure,
}: {
  lead: AdminLeadDetail;
  crmUrl: string | null;
  erasure: AdminGuestErasureState | null;
}) {
  const name = leadName(lead);
  const status = presentLeadStatus(lead);
  const crm = presentLeadCrm(lead.crm);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={<AdminBreadcrumbs list={{ label: "Leads", href: "/leads" }} current={name} />}
        title={name}
        status={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        meta={
          <>
            <MetaItem label="Source">{GUEST_LEAD_SOURCE_LABEL[lead.source]}</MetaItem>
            <MetaItem label="First seen">{formatStaffDate(lead.firstSeenAt)}</MetaItem>
            <MetaItem label="Last seen">{formatStaffDate(lead.lastSeenAt)}</MetaItem>
          </>
        }
        primaryAction={
          <LeadActions leadId={lead.leadId} email={lead.email} crmUrl={crmUrl} erasure={erasure} />
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {lead.orders.length > 0 ? (
            <Section
              title="Orders"
              description={`${lead.orders.length} placed as a guest`}
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-staff-line-subtle">
                {lead.orders.map((order) => (
                  <li
                    key={order.orderId}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link href={`/orders/${order.orderId}`} className={linkClass}>
                        {orderNumber(order.orderId, order.reference)}
                      </Link>
                      <p className="m-0 text-staff-xs text-staff-muted">
                        {ORDER_STATUS_LABELS[order.status as AdminOrderStatus] ?? order.status} ·{" "}
                        <StaffDate value={order.paidAt ?? order.createdAt} />
                      </p>
                    </div>
                    <span className="shrink-0 text-staff-sm tabular-nums text-staff-fg">
                      {formatGbp(order.totalPence)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          {lead.enquiries.length > 0 ? (
            <Section
              title="Enquiries"
              description={`${lead.enquiries.length} sent`}
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-staff-line-subtle">
                {lead.enquiries.map((enquiry) => (
                  <li
                    key={enquiry.enquiryId}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/enquiries/${enquiry.kind}/${enquiry.enquiryId}`}
                        className={linkClass}
                      >
                        {enquiry.subject}
                      </Link>
                      <p className="m-0 text-staff-xs text-staff-muted tabular-nums">
                        {enquiry.reference}
                      </p>
                    </div>
                    <span className="shrink-0 text-staff-xs text-staff-muted">
                      <StaffDate value={enquiry.createdAt} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title="Activity">
            <Timeline label="Lead activity" events={buildLeadTimeline(lead)} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Contact">
            <KeyValueList
              items={[
                { label: "Name", value: lead.name },
                { label: "Email", value: lead.email, copyValue: lead.email },
                ...(lead.phone
                  ? [{ label: "Phone", value: lead.phone, copyValue: lead.phone }]
                  : []),
              ]}
            />
          </Section>
          <Section title="Marketing consent">
            <KeyValueList
              items={[
                { label: "News by email", value: leadConsentLine(lead.consent) },
                ...(lead.consent.version
                  ? [{ label: "Wording agreed to", value: lead.consent.version }]
                  : []),
              ]}
            />
          </Section>
          <Section title="CRM">
            <div className="flex flex-col gap-3">
              <div>
                <StatusBadge tone={crm.tone}>{crm.label}</StatusBadge>
              </div>
              {lead.crmRecord ? (
                <KeyValueList
                  items={[
                    {
                      label: lead.crmRecord.module,
                      value: lead.crmRecord.recordId,
                      copyValue: lead.crmRecord.recordId,
                    },
                  ]}
                />
              ) : (
                <p className="m-0 text-staff-sm text-staff-muted">
                  {lead.crm === "failed"
                    ? "The last attempt to send this lead failed."
                    : lead.crm === "pending"
                      ? "On its way to the CRM."
                      : "This lead has not been sent to the CRM."}
                </p>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
