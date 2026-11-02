"use client";

import type { SellerAccountOption } from "@/lib/seller/seller-account-options";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { RadioCardGroup } from "@auction/ui/components/radio-card-group";
import { Surface } from "@auction/ui/components/surface";
import { Button } from "@auction/ui/lax";
import Link from "next/link";

type Props = {
  options: readonly SellerAccountOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  registerHref: string;
  busy: boolean;
  /**
   * The step comes first ("Selling as"): one way on, to the work. Without it the step comes
   * last and sends the work.
   */
  onContinue?: () => void;
  onBack?: () => void;
  onSubmit?: () => void;
  onSaveDraft?: () => void;
};

function OptionLabel({ option }: { option: SellerAccountOption }) {
  return (
    <>
      <span className="font-semibold">{option.kind === "personal" ? "Personal" : option.name}</span>
      <span className="font-normal text-on-surface-variant">
        {" · "}
        {option.kind === "personal" ? option.name : option.roleLabel}
      </span>
    </>
  );
}

/**
 * "Who is selling?": Personal, or an organisation the person may hand in work for. With no
 * organisation it simply says the work is sold under their own name. An organisation still
 * under review can keep the work as a draft, and the page says why it cannot be sent yet.
 */
export function SellerAccountStep({
  options,
  selectedId,
  onSelect,
  registerHref,
  busy,
  onContinue,
  onBack,
  onSubmit,
  onSaveDraft,
}: Props) {
  const selected = options.find((option) => option.id === selectedId) ?? options[0] ?? null;
  const onlyPersonal = options.length === 1 && selected?.kind === "personal";
  const blocked = selected !== null && !selected.canSubmit;

  return (
    <div className="space-y-6">
      {onlyPersonal && selected ? (
        <section aria-labelledby="who-is-selling" className="space-y-3">
          <h2
            id="who-is-selling"
            className="font-headline text-xl font-semibold tracking-tight text-on-surface"
          >
            Who is selling?
          </h2>
          <Surface variant="section" padding="none" className="p-4 sm:p-4">
            <p className="font-body text-sm text-on-surface">
              <OptionLabel option={selected} />
            </p>
            <p className="mt-1 font-body text-xs text-on-surface-variant">
              The work is sold under your own name, and you are paid personally.
            </p>
          </Surface>
        </section>
      ) : (
        <section className="space-y-3">
          <RadioCardGroup
            legend="Who is selling?"
            value={selected?.id ?? ""}
            onValueChange={onSelect}
            className="[&>legend]:font-headline [&>legend]:text-xl [&>legend]:font-semibold [&>legend]:tracking-tight"
            options={options.map((option) => ({
              value: option.id,
              label: <OptionLabel option={option} />,
              description:
                option.kind === "personal"
                  ? "Sold under your own name, paid to you."
                  : option.canSubmit
                    ? `Sold by ${option.name}, paid to the organisation.`
                    : "Under review. You can save a draft now.",
            }))}
          />
        </section>
      )}

      {blocked && selected?.submitBlockedReason ? (
        <Alert>
          <AlertDescription>{selected.submitBlockedReason}</AlertDescription>
        </Alert>
      ) : null}

      <p className="font-body text-sm text-on-surface-variant">
        Selling for a business?{" "}
        <Link href={registerHref} className="text-link underline underline-offset-4">
          Register an organisation
        </Link>
      </p>

      {onContinue ? (
        <div className="flex flex-col gap-3 border-t border-border-hairline pt-6 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="primary"
            onClick={onContinue}
            disabled={busy || !selected}
            data-testid="sell-flow-continue"
          >
            Continue to the work
          </Button>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-3 border-t border-border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="secondary" onClick={() => onBack?.()} disabled={busy}>
            Back to the work
          </Button>
          {blocked ? (
            <Button type="button" variant="primary" onClick={() => onSaveDraft?.()} disabled={busy}>
              {busy ? "Saving…" : "Save as draft"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => onSubmit?.()}
              disabled={busy || !selected}
              data-testid="sell-flow-submit"
            >
              {busy
                ? "Submitting…"
                : selected?.kind === "organisation"
                  ? `Submit as ${selected.name}`
                  : "Submit for review"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
