"use client";

import { markEnquiryHandledAction } from "@/lib/actions/admin/admin-enquiry";
import type { AdminEnquiry } from "@/lib/data/http/admin-enquiry.reader";
import { notify } from "@/lib/ui/notify";
import {
  DetailPage,
  KeyValueList,
  MetaItem,
  Notice,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import { Check } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

const NextLink: StaffLinkComponent = Link;

/**
 * One contact form enquiry on the staff record page: the message, how to reach the sender and
 * when the promised reply is due. Client services reply from their own mail and then mark it
 * handled; everyone else sees the page view only.
 */
export function EnquiryView({ enquiry, canAct }: { enquiry: AdminEnquiry; canAct: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const handled = enquiry.status === "closed";

  const markHandled = () =>
    startTransition(async () => {
      const result = await markEnquiryHandledAction(enquiry.id);
      if (result.ok) {
        notify.success("Enquiry marked handled");
      } else {
        notify.error(result.error);
      }
      router.refresh();
    });

  return (
    <DetailPage
      breadcrumbs={
        <StaffBreadcrumbs
          Link={NextLink}
          items={[{ label: "Work inbox", href: "/admin" }, { label: "Contact enquiry" }]}
        />
      }
      title={`${enquiry.topicLabel} enquiry from ${enquiry.name}`}
      status={
        <StatusBadge tone={handled ? "success" : "info"}>{handled ? "Handled" : "New"}</StatusBadge>
      }
      meta={
        <>
          <MetaItem label="Received">
            <StaffDate value={enquiry.receivedAt} withTime className="text-staff-fg" />
          </MetaItem>
          <MetaItem label="Reply due">
            <StaffDate value={enquiry.replyDueAt} withTime className="text-staff-fg" />
          </MetaItem>
        </>
      }
      access={canAct ? "full" : "read-only"}
      resource="Contact enquiries"
      {...(canAct && !handled
        ? {
            primaryAction: (
              <StaffButton
                variant="primary"
                icon={<Check aria-hidden />}
                loading={busy}
                onClick={markHandled}
              >
                Mark handled
              </StaffButton>
            ),
          }
        : {})}
      {...(handled && enquiry.handledAt
        ? {
            notice: (
              <Notice tone="info" title="This enquiry is handled">
                Marked handled on <StaffDate value={enquiry.handledAt} withTime />.
              </Notice>
            ),
          }
        : {})}
      rail={
        <Section id="sender" title="Sender">
          <KeyValueList
            items={[
              { label: "Name", value: enquiry.name },
              {
                label: "Email",
                value: <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>,
                copyValue: enquiry.email,
              },
              ...(enquiry.phone
                ? [{ label: "Phone", value: enquiry.phone, copyValue: enquiry.phone }]
                : []),
              { label: "Topic", value: enquiry.topicLabel },
              ...(enquiry.sourcePage ? [{ label: "Sent from", value: enquiry.sourcePage }] : []),
            ]}
          />
        </Section>
      }
      railLabel="Sender details"
    >
      <Section id="message" title="Message">
        <p className="text-staff-sm whitespace-pre-wrap break-words text-staff-fg">
          {enquiry.message}
        </p>
      </Section>
    </DetailPage>
  );
}
