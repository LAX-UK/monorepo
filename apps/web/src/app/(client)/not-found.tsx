import { AppNotFound } from "@/components/app/app-not-found";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { NOT_FOUND_PRESETS } from "@/lib/ui/empty-state-copy";

export default function DashboardNotFound() {
  const preset = NOT_FOUND_PRESETS.dashboard;
  return (
    <DashboardPage className="mx-auto max-w-xl py-12">
      <AppNotFound
        kicker={preset.kicker}
        title={preset.title}
        description={preset.description}
        primaryHref={preset.primaryHref}
        primaryLabel={preset.primaryLabel}
        secondaryHref={preset.secondaryHref}
        secondaryLabel={preset.secondaryLabel}
        illustration={preset.illustration}
      />
    </DashboardPage>
  );
}
