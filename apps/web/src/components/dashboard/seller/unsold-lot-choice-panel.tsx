"use client";

import { requestUnsoldChoiceAction } from "@/lib/actions/consignment-after-sale";
import {
  UNSOLD_CHOICE_INTRO,
  UNSOLD_CHOICE_OPTIONS,
  UNSOLD_CHOICE_ORDER,
  type UnsoldChoiceHistoryEntry,
  type UnsoldChoiceViewModel,
} from "@/lib/seller/unsold-choice-view";
import { notify } from "@/lib/ui/notify";
import type { UnsoldLotChoiceKind } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { RadioCardGroup } from "@auction/ui/components/radio-card-group";
import { Surface } from "@auction/ui/components/surface";
import { Button } from "@auction/ui/lax";
import { CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  submissionId: string;
  view: UnsoldChoiceViewModel;
  /** The choice already asked for, to start the form from when changing it. */
  current?: { choice: UnsoldLotChoiceKind; reserve: string | null } | null;
};

const RADIO_OPTIONS = UNSOLD_CHOICE_ORDER.map((value) => ({
  value,
  label: UNSOLD_CHOICE_OPTIONS[value].label,
  description: UNSOLD_CHOICE_OPTIONS[value].description,
}));

function History({ entries }: { entries: readonly UnsoldChoiceHistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="space-y-2 border-t border-border-hairline pt-4" aria-label="History">
      {entries.map((entry) => (
        <li key={entry.label} className="font-body text-sm text-on-surface-variant">
          <span className="text-on-surface">{entry.label}</span> · {entry.by}, {entry.on}
        </li>
      ))}
    </ol>
  );
}

function ChoiceForm({
  submissionId,
  reserveHint,
  initial,
  onCancel,
}: {
  submissionId: string;
  reserveHint: string;
  initial: { choice: UnsoldLotChoiceKind; reserve: string | null } | null;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const reserveId = useId();
  const hintId = useId();
  const [choice, setChoice] = useState<UnsoldLotChoiceKind | "">(initial?.choice ?? "");
  const [reserve, setReserve] = useState(initial?.reserve ?? "");
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    if (!choice) {
      setFailure("Choose what happens next.");
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await requestUnsoldChoiceAction(submissionId, {
        choice,
        reserve: choice === "relist" ? reserve : null,
      });
      if (result.ok) {
        notify.success("Sent to your specialist");
        onCancel?.();
        router.refresh();
        return;
      }
      setFailure(result.error);
    });
  };

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <RadioCardGroup
        legend="What would you like us to do?"
        value={choice}
        onValueChange={(value) => setChoice(value as UnsoldLotChoiceKind)}
        options={RADIO_OPTIONS}
      />
      {choice === "relist" ? (
        <div className="space-y-1.5">
          <Label htmlFor={reserveId} className="font-body text-sm text-on-surface">
            Lower reserve (optional)
          </Label>
          <Input
            id={reserveId}
            inputMode="decimal"
            autoComplete="off"
            placeholder="For example 4500"
            value={reserve}
            onChange={(event) => setReserve(event.target.value)}
            aria-describedby={hintId}
            className="max-w-xs"
            disabled={pending}
          />
          <p id={hintId} className="font-body text-xs text-on-surface-variant">
            {reserveHint}
          </p>
        </div>
      ) : null}
      {failure ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sending…" : "Send to your specialist"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            Keep my choice
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * "Choose what happens next" for a consigned lot that did not sell: the seller asks for a relist
 * (perhaps with a lower reserve), a private sale or its return, and a specialist confirms it.
 * Members who cannot choose see who can, then the choice once made.
 */
export function UnsoldLotChoicePanel({
  submissionId,
  view,
  current = null,
  deadline = null,
}: Props & {
  /** The date the choice is due ("12 Nov"), while nothing has been chosen. */
  deadline?: string | null;
}) {
  const [changing, setChanging] = useState(false);
  const intro = UNSOLD_CHOICE_INTRO[changing ? "choose" : view.mode];

  return (
    <section aria-labelledby="unsold-choice-heading" id="unsold" className="scroll-mt-24">
      <Surface variant="section" className="space-y-5" data-testid="unsold-choice">
        <div className="space-y-1">
          <h2
            id="unsold-choice-heading"
            className="font-headline text-lg font-semibold tracking-tight text-on-surface"
          >
            {intro.heading}
          </h2>
          <p className="font-body text-sm text-on-surface-variant">{intro.intro}</p>
          {deadline && (view.mode === "choose" || view.mode === "waiting_on_admin") ? (
            <p className="font-body text-sm font-medium text-on-surface">
              Choose by {deadline}. If no choice is made by then, a specialist will contact you.
            </p>
          ) : null}
        </div>

        {view.mode === "choose" ? (
          <ChoiceForm submissionId={submissionId} reserveHint={view.reserveHint} initial={null} />
        ) : null}

        {view.mode === "waiting_on_admin" ? (
          <p className="font-body text-sm text-on-surface">{view.message}</p>
        ) : null}

        {view.mode === "paused" ? (
          <div className="space-y-4">
            <p className="font-body text-sm text-on-surface">{view.message}</p>
            <Button asChild variant="secondary">
              <a href={view.contact.href}>{view.contact.label}</a>
            </Button>
          </div>
        ) : null}

        {view.mode === "requested" ? (
          changing ? (
            <ChoiceForm
              submissionId={submissionId}
              reserveHint={view.reserveHint}
              initial={current}
              onCancel={() => setChanging(false)}
            />
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-2 font-body text-sm text-on-surface">
                <Clock className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
                <span>
                  <span className="font-semibold">{view.summary}.</span> Waiting for your specialist
                  to confirm.
                </span>
              </p>
              {view.canChange ? (
                <Button type="button" variant="secondary" onClick={() => setChanging(true)}>
                  Change my choice
                </Button>
              ) : null}
              <History entries={view.history} />
            </div>
          )
        ) : null}

        {view.mode === "confirmed" ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 font-body text-sm text-on-surface">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span className="font-semibold">{view.summary}.</span>
            </p>
            {view.note ? (
              <div className="rounded-lg border border-border-hairline bg-surface-container-low p-4">
                <p className="font-body text-xs text-on-surface-variant">
                  Note from your specialist
                </p>
                <p className="mt-1 font-body text-sm text-on-surface">{view.note}</p>
              </div>
            ) : null}
            <History entries={view.history} />
          </div>
        ) : null}
      </Surface>
    </section>
  );
}
