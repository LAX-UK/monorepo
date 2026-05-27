"use client";

import { persistAdminDashboardWidgetsAction } from "@/lib/actions/admin-dashboard-widgets";
import {
  DEFAULT_DASHBOARD_WIDGETS,
  type DashboardWidgetId,
  type DashboardWidgetState,
} from "@/lib/admin/dashboard-widgets.vm";
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
  "saleroom-live": { label: "Saleroom live", description: "Live bidding placeholder" },
  activity: { label: "Recent activity", description: "Latest catalog movement" },
};

type Props = {
  widgets: readonly DashboardWidgetState[];
};

export function PersonalDashboardCustomizeSheet({ widgets }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DashboardWidgetState[]>([...widgets]);
  const [pending, startTransition] = useTransition();

  const toggle = (id: DashboardWidgetId) => {
    setSelected((prev) => prev.map((w) => (w.id === id ? { ...w, hidden: !w.hidden } : w)));
  };

  const save = () => {
    startTransition(async () => {
      await persistAdminDashboardWidgetsAction(selected);
      setOpen(false);
      router.refresh();
    });
  };

  const reset = () => {
    setSelected([...DEFAULT_DASHBOARD_WIDGETS]);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            Reset defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
