import { AppNotFound } from "@/components/app/app-not-found";
import { NOT_FOUND_PRESETS } from "@/lib/ui/empty-state-copy";

export default function AdminNotFound() {
  const preset = NOT_FOUND_PRESETS.admin;
  return (
    <AppNotFound
      kicker={preset.kicker}
      title={preset.title}
      description={preset.description}
      primaryHref={preset.primaryHref}
      primaryLabel={preset.primaryLabel}
      illustration={preset.illustration}
    />
  );
}
