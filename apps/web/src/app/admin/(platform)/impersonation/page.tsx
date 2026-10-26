import { AdminImpersonateForm } from "@/components/admin/admin-impersonate-form";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { FormPage } from "@auction/staff-ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Support session",
  "Act as a legal entity to help its members.",
);

/** Start a support session as a legal entity, for platform admins (the layout checks access). */
export default function AdminImpersonationPage() {
  return (
    <FormPage
      title="Support session"
      description="Act as a legal entity to help its members. You can also start one from a legal entity's page."
    >
      <AdminImpersonateForm />
    </FormPage>
  );
}
