import { EnquiriesList } from "@/components/admin/enquiries/enquiries-list";
import { buildEnquiriesChips } from "@/lib/admin/enquiries/enquiries-search";
import {
  ENQUIRY_KIND_LABELS,
  ENQUIRY_STATUS_LABELS,
  humaniseSlug,
} from "@/lib/admin/enquiries/enquiries.vm";
import { enquiryAbilities } from "@/lib/admin/enquiries/enquiry-access";
import { routingRows } from "@/lib/admin/enquiries/enquiry-routing-rows";
import { loadAdminEnquiriesPage } from "@/lib/admin/enquiries/load-enquiries-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getEnquiryRouting } from "@/lib/data/http/admin-enquiries.reader";
import { ENQUIRIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Enquiries",
  "Every enquiry from the contact form and the private sales page, with who has it and how long it has waited.",
);

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminCapability(ENQUIRIES_ACCESS, "/admin/enquiries");
  const sp = await searchParams;
  const abilities = enquiryAbilities({ role: user.role as UserRole, staffRoles: user.staffRoles });
  const [model, routing] = await Promise.all([
    loadAdminEnquiriesPage(sp, abilities),
    abilities.canRoute ? getEnquiryRouting() : Promise.resolve(null),
  ]);
  const departmentLabel = (slug: string) =>
    routingRows([]).find((row) => row.slug === slug)?.label ?? humaniseSlug(slug);
  const chips = buildEnquiriesChips(model.filters, sp, abilities.defaultView, {
    kind: (value) => ENQUIRY_KIND_LABELS[value as keyof typeof ENQUIRY_KIND_LABELS] ?? value,
    department: departmentLabel,
    status: (value) => ENQUIRY_STATUS_LABELS[value as keyof typeof ENQUIRY_STATUS_LABELS] ?? value,
    assignee: (value) =>
      value === "unassigned"
        ? "Unassigned"
        : (model.assignees.find((person) => person.id === value)?.name ?? "Former staff member"),
  });

  return (
    <EnquiriesList
      page={model.page}
      search={sp}
      filters={model.filters}
      chips={chips}
      assignees={model.assignees}
      routing={routing}
      abilities={abilities}
      pagination={model.pagination}
      loadError={model.loadError}
      filtered={model.filtered}
      now={new Date().toISOString()}
    />
  );
}
