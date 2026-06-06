"use client";

import { persistAdminDashboardWidgetsAction } from "@/lib/actions/admin-dashboard-widgets";
import {
  type DashboardWidgetId,
  type DashboardWidgetState,
  defaultDashboardWidgetsForStaffRole,
} from "@/lib/admin/dashboard-widgets.vm";
import { notify } from "@/lib/ui/notify";
import type { UserStaffRole } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const WIDGET_LABELS: Record<DashboardWidgetId, { label: string; description: string }> = {
  greeting: { label: "Greeting", description: "Personal welcome and quick links" },
  "kpi-band": { label: "Trend KPIs", description: "Period comparison metrics with sparklines" },
  "my-queue": { label: "My queue", description: "Attention items needing action" },
  anomalies: { label: "Anomalies", description: "Operational callouts above threshold" },
  "saleroom-live": { label: "Saleroom live", description: "Live bidding pulse and saleroom link" },
  "onsite-radar": {
    label: "Onsite radar",
    description: "Pending registrations and telephone lines on onsite sales",
  },
  activity: { label: "Recent activity", description: "Latest catalog movement" },
};

type Props = {
  widgets: readonly DashboardWidgetState[];
  staffRole?: UserStaffRole | null;
};

export function PersonalDashboardCustomizeSheet({ widgets, staffRole = null }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DashboardWidgetState[]>([...widgets]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: DashboardWidgetId) => {
    setSelected((prev) => prev.map((w) => (w.id === id ? { ...w, hidden: !w.hidden } : w)));
  };

  const save = () => {
    startTransition(async () => {
      setError(null);
      try {
        await persistAdminDashboardWidgetsAction(selected);
        notify.success("Dashboard layout saved");
        setOpen(false);
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not save dashboard layout.";
        setError(message);
        notify.error(message);
      }
    });
  };

  const reset = () => {
    setSelected([...defaultDashboardWidgetsForStaffRole(staffRole)]);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSelected([...widgets]);
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="min-h-9 gap-1">
          <Settings2 className="size-4" aria-hidden />
          Customize
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Dashboard widgets</SheetTitle>
        </SheetHeader>
        {error ? (
          <p className="mt-4 rounded-md border border-error/30 bg-error-container/20 p-3 text-sm text-on-surface">
            {error}
          </p>
        ) : null}
        <ul className="mt-6 space-y-3">
          {selected.map((w) => {
            const meta = WIDGET_LABELS[w.id];
            return (
              <li key={w.id}>
                <label
                  htmlFor={`widget-${w.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border-hairline p-3"
                >
                  <Checkbox
                    id={`widget-${w.id}`}
                    className="mt-1"
                    checked={!w.hidden}
                    onCheckedChange={() => toggle(w.id)}
                  />
                  <span>
                    <span className="block font-label text-sm font-semibold text-on-surface">
                      {meta.label}
                    </span>
                    <span className="block font-body text-xs text-on-surface-variant">
                      {meta.description}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="default" disabled={pending} onClick={save}>
            Save layout
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={reset}>
            Reset to role default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
