"use client";

import { setAlertTopicAction } from "@/server/application/alert-preference-actions.server";
import type { AlertSectionVm } from "@/server/domain/account-alerts.vm";
import { buildReauthHref } from "@/server/domain/account-reauth";
import type { AlertTopicId } from "@/server/ports/alert-preferences-gateway";
import { cn } from "@auction/ui";
import { TextLink, ToggleRow } from "@auction/ui/lax";
import { useState } from "react";
import { AccountSection, CARD, LIST_ROW } from "./account-ui";
import { withProductNames } from "./product-name";

type RowState = { on: boolean; saving: boolean; error: string | null };

type AlertPreferencesProps = {
  sections: AlertSectionVm[];
  /** Switches are disabled until the address is verified. */
  disabled: boolean;
  returnTo: string;
};

/**
 * The person's alert emails, one card per product. A switch keeps its new position while it is
 * saved; if the product refuses or cannot be reached it goes back and says why on its own row,
 * so the page never shows a choice that was not stored. A product that cannot be loaded says so
 * and leaves the others usable.
 */
export function AlertPreferences({ sections, disabled, returnTo }: AlertPreferencesProps) {
  const [rows, setRows] = useState<Partial<Record<AlertTopicId, RowState>>>(() =>
    Object.fromEntries(
      sections.flatMap((section) =>
        section.rows.map((row) => [row.topic, { on: row.emailOn, saving: false, error: null }]),
      ),
    ),
  );
  const [saved, setSaved] = useState(false);

  function patch(topic: AlertTopicId, next: Partial<RowState>) {
    setRows((current) => {
      const previous = current[topic] ?? { on: false, saving: false, error: null };
      return { ...current, [topic]: { ...previous, ...next } };
    });
  }

  async function change(topic: AlertTopicId, on: boolean) {
    setSaved(false);
    patch(topic, { on, saving: true, error: null });
    const result = await setAlertTopicAction({ topic, on }).catch(
      () =>
        ({
          status: "error",
          message: "We couldn't save that just now. Nothing was changed. Please try again.",
        }) as const,
    );
    if (result.status === "reauth_required") {
      window.location.assign(buildReauthHref(returnTo));
      return;
    }
    if (result.status === "error") {
      patch(topic, { on: !on, saving: false, error: result.message });
      return;
    }
    patch(topic, { saving: false });
    setSaved(true);
  }

  return (
    <>
      {sections.map((section) => (
        <AccountSection key={section.id} id={`alerts-${section.id}`} title={section.label}>
          {section.state === "unavailable" ? (
            <div className={cn(CARD, LIST_ROW, "justify-between")}>
              <p className="text-sm text-on-surface-variant">
                {withProductNames(section.unavailableMessage)}
              </p>
              <TextLink href={returnTo} className="inline-flex min-h-11 items-center">
                Try again
              </TextLink>
            </div>
          ) : (
            <div className={cn(CARD, "divide-y divide-border-hairline px-4 sm:px-6")}>
              {section.rows.map((row) => {
                const state = rows[row.topic] ?? {
                  on: row.emailOn,
                  saving: false,
                  error: null,
                };
                return (
                  <ToggleRow
                    key={row.topic}
                    label={row.title}
                    description={row.description}
                    checked={state.on}
                    saving={state.saving}
                    error={state.error}
                    disabled={disabled || state.saving}
                    onCheckedChange={(on) => void change(row.topic, on)}
                  />
                );
              })}
            </div>
          )}
          {section.note ? (
            <p className="text-sm text-on-surface-variant">
              {withProductNames(section.note.text)}
              {section.note.link ? (
                <>
                  {" "}
                  <TextLink href={section.note.link.href}>{section.note.link.label}</TextLink>
                </>
              ) : null}
              {section.note.end ?? null}
            </p>
          ) : null}
        </AccountSection>
      ))}
      <output className="sr-only" aria-live="polite">
        {saved ? "All changes saved" : ""}
      </output>
      <p
        aria-hidden
        className={cn(
          "text-sm text-on-surface-variant transition-opacity",
          saved ? "opacity-100" : "opacity-0",
        )}
      >
        All changes saved
      </p>
    </>
  );
}
