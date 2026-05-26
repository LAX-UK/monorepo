import { AppNotFound } from "@/components/app/app-not-found";
import { NOT_FOUND_PRESETS } from "@/lib/ui/empty-state-copy";

export default function TaskNotFound() {
  const preset = NOT_FOUND_PRESETS.task;
  return (
    <main id="main-content" className="min-h-[50vh] bg-surface">
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
    </main>
  );
}
