"use client";

import {
  clearWizardDraft,
  readWizardDraft,
  wizardDraftCookieKey,
  writeWizardDraft,
} from "@/components/admin/admin-form-wizard/wizard-draft";
import { WizardDraftSaveIndicator } from "@/components/admin/admin-form-wizard/wizard-draft-save-indicator";
import { Notice, StaffButton, formatStaffDateTime } from "@auction/staff-ui";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

const AUTOSAVE_MS = 30_000;

type Saved = { values: Record<string, unknown>; savedAt: string };

/**
 * Keeps a new record's unfinished form on this device: saved every 30 seconds while there are
 * changes, offered back ("Resume draft") the next time the form opens, and cleared once the
 * record is created. Edits to an existing record are not drafted; they are saved or discarded.
 */
export function useFormDraft<T extends FieldValues>({
  form,
  entityKind,
  entityId = "new",
  enabled,
}: {
  form: UseFormReturn<T>;
  entityKind: string;
  entityId?: string;
  enabled: boolean;
}): { banner: ReactNode; status: ReactNode; clear: () => void } {
  const key = wizardDraftCookieKey(entityKind, entityId);
  const dirty = form.formState.isDirty;
  const [offered, setOffered] = useState<Saved | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (!enabled) return;
    const found = readWizardDraft(key);
    if (found) setOffered({ values: found.values, savedAt: found.savedAt });
  }, [enabled, key]);

  const persist = useCallback(() => {
    const now = new Date().toISOString();
    writeWizardDraft(key, {
      stepIndex: 0,
      values: formRef.current.getValues() as Record<string, unknown>,
      savedAt: now,
    });
    setSavedAt(now);
  }, [key]);

  useEffect(() => {
    if (!enabled || !dirty) return;
    const timer = window.setInterval(persist, AUTOSAVE_MS);
    const onLeave = () => persist();
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [enabled, dirty, persist]);

  const clear = useCallback(() => {
    clearWizardDraft(key);
    setSavedAt(null);
    setOffered(null);
  }, [key]);

  const resume = () => {
    if (!offered) return;
    for (const [name, value] of Object.entries(offered.values)) {
      formRef.current.setValue(name as never, value as never, { shouldDirty: true });
    }
    setOffered(null);
  };

  const banner = offered ? (
    <Notice
      tone="info"
      title="You have an unfinished draft"
      actions={
        <>
          <StaffButton size="sm" variant="ghost" onClick={clear}>
            Discard draft
          </StaffButton>
          <StaffButton size="sm" variant="secondary" onClick={resume}>
            Resume draft
          </StaffButton>
        </>
      }
    >
      Saved on this device {formatStaffDateTime(offered.savedAt, { zoneLabel: true })}.
    </Notice>
  ) : null;

  const status =
    enabled && savedAt ? <WizardDraftSaveIndicator status="saved" savedAt={savedAt} /> : null;

  return { banner, status, clear };
}
