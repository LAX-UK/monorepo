import { AppNotFound } from "@/components/app/app-not-found";
import { NOT_FOUND_PRESETS } from "@/lib/ui/empty-state-copy";

export default function NotFound() {
  const preset = NOT_FOUND_PRESETS.root;
  return (
    <main id="main-content" className="min-h-[70vh] bg-surface">
      <AppNotFound
        kicker={preset.kicker}
        title={preset.title}
        description={preset.description}
        primaryHref={preset.primaryHref}
        primaryLabel={preset.primaryLabel}
        searchHref={preset.secondaryHref}
        searchLabel={preset.secondaryLabel}
        illustration={preset.illustration}
      />
    </main>
  );
}
