"use client";

import { persistAdminDashboardWidgetsAction } from "@/lib/actions/admin-dashboard-widgets";
import {
  type DashboardWidgetId,
  type DashboardWidgetState,
  defaultDashboardWidgetsForStaffRole,
} from "@/lib/admin/dashboard-widgets.vm";
import { notify } from "@/lib/ui/notify";
import { ChoiceRow, DetailPanel, Notice, StaffButton, StaffCheckbox } from "@auction/staff-ui";
import type { StaffRoles } from "@auction/types";
import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export const DASHBOARD_WIDGET_COPY: Record<
  DashboardWidgetId,
  { label: string; description: string }
> = {
  greeting: { label: "Greeting", description: "Your name in the title and your usual next link." },
  "my-queue": { label: "Your work", description: "Items waiting on you, with their actions." },
  "kpi-band": {
    label: "Numbers",
    description: "Up to four numbers for your role, with their trends.",
  },
  "saleroom-live": {
    label: "Saleroom pulse",
    description: "Bids per minute and live saleroom sessions.",
  },
  "onsite-radar": {
    label: "Upcoming sales",
    description: "Sales about to open and what still blocks them.",
  },
  activity: { label: "Recent activity", description: "Lots changed most recently." },
};

/**
 * Choose what Overview shows: a side panel with one checkbox per block, saved for this person.
 * Reset goes back to the blocks for their role. A failed save stays in the panel.
 */
export function CustomisePanel({
  widgets,
  staffRoles,
}: {
  widgets: readonly DashboardWidgetState[];
  staffRoles?: StaffRoles | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DashboardWidgetState[]>([...widgets]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const dirty = selected.some(
    (widget) => widgets.find((saved) => saved.id === widget.id)?.hidden !== widget.hidden,
  );

  const show = () => {
    setSelected([...widgets]);
    setError(null);
    setOpen(true);
  };

  const toggle = (id: DashboardWidgetId, visible: boolean) =>
    setSelected((current) =>
      current.map((widget) => (widget.id === id ? { ...widget, hidden: !visible } : widget)),
    );

  const save = () => {
    if (selected.every((widget) => widget.hidden)) {
      setError("Keep at least one block on Overview.");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        await persistAdminDashboardWidgetsAction(selected);
        notify.success("Overview layout saved");
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The layout could not be saved.");
      }
    });
  };

  return (
    <>
      <StaffButton icon={<Settings2 aria-hidden />} onClick={show}>
        Customise
      </StaffButton>
      <DetailPanel
        open={open}
        onOpenChange={setOpen}
        title="Customise Overview"
        description="Choose the blocks you see. Only you see this layout."
        dirty={dirty}
        dirtyLabel="the Overview layout"
        footer={
          <>
            <StaffButton
              variant="ghost"
              disabled={saving}
              onClick={() => setSelected([...defaultDashboardWidgetsForStaffRole(staffRoles)])}
            >
              Reset to your role's layout
            </StaffButton>
            <StaffButton variant="primary" loading={saving} onClick={save}>
              Save layout
            </StaffButton>
          </>
        }
      >
        {error ? (
          <Notice tone="danger" alert title="The layout was not saved">
            {error}
          </Notice>
        ) : null}
        <fieldset>
          <legend className="sr-only">Blocks on Overview</legend>
          {selected.map((widget) => {
            const copy = DASHBOARD_WIDGET_COPY[widget.id];
            const id = `overview-block-${widget.id}`;
            return (
              <ChoiceRow
                key={widget.id}
                htmlFor={id}
                label={copy.label}
                description={copy.description}
                control={
                  <StaffCheckbox
                    id={id}
                    checked={!widget.hidden}
                    onCheckedChange={(checked) => toggle(widget.id, checked === true)}
                  />
                }
              />
            );
          })}
        </fieldset>
      </DetailPanel>
    </>
  );
}
