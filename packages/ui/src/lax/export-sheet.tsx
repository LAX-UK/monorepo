"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { Button } from "./button.js";
import { Dialog, DialogClose } from "./dialog.js";
import { Field } from "./field.js";
import { TextInput } from "./input.js";
import { PresetCards, type PresetOption } from "./preset-cards.js";
import { SegmentedControl } from "./tabs.js";

export type ExportScope = "view" | "all";

export type ExportRequest<F extends string> = {
  scope: ExportScope;
  format: F;
  /** Whole days as `YYYY-MM-DD`, when the list offers a period. */
  from?: string;
  to?: string;
};

export type ExportSheetProps<F extends string> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is exported, in the title: "sold works" makes "Export sold works". */
  subject: string;
  /** How many records the current view holds: "This view (23)". */
  viewCount: number;
  formats: readonly PresetOption<F>[];
  defaultFormat: F;
  /** Offer a period, with these first values. */
  period?: { from: string; to: string };
  /** A line under the choices: "Large exports are prepared in the background…". */
  note?: React.ReactNode;
  /** Starts the export; the sheet closes once it resolves. */
  onExport: (request: ExportRequest<F>) => Promise<void> | void;
};

/**
 * One export sheet for every list: what (this view or everything), an optional period, the
 * format as preset cards, and one Export action. It follows the list's filters by default, so
 * the file matches what the person sees.
 */
export function ExportSheet<F extends string>({
  open,
  onOpenChange,
  subject,
  viewCount,
  formats,
  defaultFormat,
  period,
  note,
  onExport,
}: ExportSheetProps<F>) {
  const [scope, setScope] = React.useState<ExportScope>("view");
  const [format, setFormat] = React.useState<F>(defaultFormat);
  const [from, setFrom] = React.useState(period?.from ?? "");
  const [to, setTo] = React.useState(period?.to ?? "");
  const [busy, setBusy] = React.useState(false);
  const invalidPeriod = Boolean(period && from && to && from > to);

  const submit = async () => {
    setBusy(true);
    try {
      await onExport({ scope, format, ...(period ? { from, to } : {}) });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Export ${subject}`}
      footer={
        <>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            icon={<Download aria-hidden />}
            loading={busy}
            onClick={() => void submit()}
            {...(invalidPeriod ? { disabledReason: "Choose a start before the end" } : {})}
          >
            Export
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-lax-ui font-medium text-lax-fg">What</legend>
          <SegmentedControl<ExportScope>
            value={scope}
            onValueChange={setScope}
            label="What to export"
            size="md"
            options={[
              { value: "view", label: `This view (${viewCount})` },
              { value: "all", label: "Everything" },
            ]}
          />
        </fieldset>
        {period ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <TextInput
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field label="To" error={invalidPeriod ? "Choose a date after the start" : null}>
              <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        ) : null}
        <fieldset>
          <legend className="mb-2 text-lax-ui font-medium text-lax-fg">Format</legend>
          <PresetCards<F>
            value={format}
            onValueChange={setFormat}
            options={formats}
            label="Format"
            columns={formats.length >= 2 ? 2 : 1}
          />
        </fieldset>
        {note ? <p className="text-lax-13 text-lax-muted">{note}</p> : null}
      </div>
    </Dialog>
  );
}
