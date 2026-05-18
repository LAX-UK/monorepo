import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { Separator } from "@auction/ui/components/separator";

export default function AdminPlatformSettingsPage() {
  return (
    <AdminPanelPage
      className="max-w-3xl space-y-8"
      title="Platform defaults"
      description="Buyer premium ladders, currency display rules, increment tables, soft-close windows, upload ceilings, and provider health checks consolidate here with audited writes."
    >
      <Separator />
      <section className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low/40 p-8 font-body text-sm text-on-surface-variant">
        Configuration forms ship incrementally—each toggle posts through audited admin APIs so
        finance and operations retain traceability.
      </section>
    </AdminPanelPage>
  );
}
