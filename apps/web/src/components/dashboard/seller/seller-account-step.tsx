"use client";

import type { SellerAccountOption } from "@/lib/seller/seller-account-options";
import { Button, ButtonLink, Notice, PresetCards, TextLink } from "@auction/ui/lax";
import Link from "next/link";

type Props = {
  options: readonly SellerAccountOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** "Register an organisation", or `null` for someone already acting for one. */
  registerHref: string | null;
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

const HEADING = "font-lax-display text-lax-18 font-semibold text-lax-fg";

function optionTitle(option: SellerAccountOption): string {
  return option.kind === "personal" ? "Personal" : option.name;
}

function optionDescription(option: SellerAccountOption): string {
  if (option.kind === "personal") return `${option.name} · Sold under your own name, paid to you.`;
  if (option.canSubmit) return `Sold by ${option.name}, paid to the organisation.`;
  return option.sellingNote?.summary ?? "You can save a draft now.";
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
    <div className="flex flex-col gap-6">
      <section aria-labelledby="who-is-selling" className="flex flex-col gap-3">
        <h2 id="who-is-selling" className={HEADING}>
          Who is selling?
        </h2>
        {onlyPersonal && selected ? (
          <div className="rounded-lax-card border border-lax-line bg-lax-surface p-4">
            <p className="text-lax-14 font-semibold text-lax-fg">{optionTitle(selected)}</p>
            <p className="mt-1 text-lax-13 text-lax-muted">
              {selected.name} · The work is sold under your own name, and you are paid personally.
            </p>
          </div>
        ) : (
          <PresetCards
            label="Who is selling?"
            columns={1}
            compact
            value={selected?.id ?? ""}
            onValueChange={onSelect}
            options={options.map((option) => ({
              value: option.id,
              label: optionTitle(option),
              description: optionDescription(option),
              ...(option.kind === "organisation"
                ? {
                    tag: (
                      <span className="text-lax-13 font-normal text-lax-muted">
                        {option.roleLabel}
                      </span>
                    ),
                  }
                : {}),
            }))}
          />
        )}
      </section>

      {blocked && selected?.submitBlockedReason ? (
        <Notice
          tone="info"
          title={selected.sellingNote?.notice ?? selected.submitBlockedReason}
          {...(selected.sellingNote?.step
            ? {
                actions: (
                  <ButtonLink href={selected.sellingNote.step.href} Link={Link} variant="secondary">
                    {selected.sellingNote.step.label}
                  </ButtonLink>
                ),
              }
            : {})}
        />
      ) : null}

      {registerHref ? (
        <p className="text-lax-14 text-lax-muted">
          Selling for a business?{" "}
          <TextLink href={registerHref} Link={Link}>
            Register an organisation
          </TextLink>
        </p>
      ) : null}

      {onContinue ? (
        <div className="flex flex-col gap-3 border-t border-lax-line pt-6 sm:flex-row sm:justify-end">
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
        <div className="flex flex-col-reverse gap-3 border-t border-lax-line pt-6 sm:flex-row sm:items-center sm:justify-between">
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
