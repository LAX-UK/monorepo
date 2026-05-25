"use client";

import { PreferencesRow, PreferencesSection } from "@/components/settings/preferences-row";
import { persistDashboardDensityCookieAction } from "@/lib/actions/dashboard-density";
import {
  resetLayoutPreferencesAction,
  updateUiPreferencesAction,
} from "@/lib/actions/user-ui-preferences";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { SegmentToggle } from "@auction/ui/components/segment-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Switch } from "@auction/ui/components/switch";
import type { DensityPreference, LayoutViewDefault, ThemePreference } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

export type AppearancePreferencesSnapshot = {
  theme: ThemePreference;
  viewLotsDefault: LayoutViewDefault;
  viewArtistsDefault: LayoutViewDefault;
  viewSalesDefault: LayoutViewDefault;
  density: DensityPreference;
  viewSync: boolean;
};

const VIEW_OPTIONS: { value: LayoutViewDefault; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "grid", label: "Grid" },
  { value: "card", label: "Card" },
  { value: "list", label: "List" },
];

export function AppearanceLayoutPreferencesForm({
  initial,
}: {
  initial: AppearancePreferencesSnapshot;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [theme, setTheme] = useState(initial.theme);
  const [viewLots, setViewLots] = useState(initial.viewLotsDefault);
  const [viewArtists, setViewArtists] = useState(initial.viewArtistsDefault);
  const [viewSales, setViewSales] = useState(initial.viewSalesDefault);
  const [density, setDensity] = useState(initial.density);
  const [viewSync, setViewSync] = useState(initial.viewSync);

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      startTransition(() => {
        void updateUiPreferencesAction(patch).then((res) => {
          if (res.ok) {
            notify.success("Saved", { duration: 2500 });
            router.refresh();
          } else {
            notify.error(res.error);
          }
        });
      });
    },
    [router],
  );

  const onTheme = (next: ThemePreference) => {
    setTheme(next);
    applyThemeDom(next);
    save({ theme: next });
  };

  const onDensity = (next: DensityPreference) => {
    setDensity(next);
    void persistDashboardDensityCookieAction(next === "compact" ? "compact" : "normal");
    save({ density: next });
  };

  return (
    <div className="space-y-8">
      <PreferencesSection title="Colour scheme">
        <PreferencesRow
          id="theme"
          label="Theme"
          description="Applies across marketing and dashboard. The header quick toggle switches to Light or Dark and overrides Auto until you choose Auto again."
          control={
            <SegmentToggle<ThemePreference>
              aria-label="Theme"
              value={theme}
              disabled={pending}
              onValueChange={onTheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "Auto" },
              ]}
            />
          }
        />
      </PreferencesSection>

      <PreferencesSection title="Default catalogue view">
        <PreferencesRow
          id="view-lots"
          label="Lots (search & archive)"
          description="When not Auto, used as default until you change view on a device."
          control={
            <Select
              value={viewLots}
              disabled={pending}
              onValueChange={(v) => {
                const next = v as LayoutViewDefault;
                setViewLots(next);
                save({ viewLotsDefault: next });
              }}
            >
              <SelectTrigger className="w-[140px]" id="view-lots">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <PreferencesRow
          id="view-artists"
          label="Artists directory"
          control={
            <Select
              value={viewArtists}
              disabled={pending}
              onValueChange={(v) => {
                const next = v as LayoutViewDefault;
                setViewArtists(next);
                save({ viewArtistsDefault: next });
              }}
            >
              <SelectTrigger className="w-[140px]" id="view-artists">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <PreferencesRow
          id="view-sales"
          label="Sales calendar"
          control={
            <Select
              value={viewSales}
              disabled={pending}
              onValueChange={(v) => {
                const next = v as LayoutViewDefault;
                setViewSales(next);
                save({ viewSalesDefault: next });
              }}
            >
              <SelectTrigger className="w-[140px]" id="view-sales">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </PreferencesSection>

      <PreferencesSection title="Layout & sync">
        <PreferencesRow
          id="density"
          label="Dashboard density"
          description="Comfortable spacing or compact tables."
          control={
            <SegmentToggle<DensityPreference>
              aria-label="Density"
              value={density}
              disabled={pending}
              onValueChange={onDensity}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
          }
        />
        <PreferencesRow
          id="view-sync"
          label="Sync views across devices"
          description="When on, defaults above apply on every device before per-page cookies."
          control={
            <Switch
              id="view-sync"
              checked={viewSync}
              disabled={pending}
              onCheckedChange={(checked) => {
                setViewSync(checked);
                save({ viewSync: checked });
              }}
            />
          }
        />
      </PreferencesSection>

      <div className="flex flex-col items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="text-primary"
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              void resetLayoutPreferencesAction().then((res) => {
                if (res.ok) {
                  setViewLots("auto");
                  setViewArtists("auto");
                  setViewSales("auto");
                  notify.success("Layout defaults reset");
                  router.refresh();
                } else {
                  notify.error(res.error);
                }
              });
            });
          }}
        >
          Reset layout to defaults
        </Button>
        <p className="max-w-md text-right text-xs text-on-surface-variant">
          Resets per-page view choices on this device and all your saved devices.
        </p>
      </div>
    </div>
  );
}
