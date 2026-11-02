"use client";

import { adminSaveSaleCoverAction } from "@/lib/actions/admin-sale-cover";
import {
  type CoverDraft,
  type HomeDraft,
  type SlotDraft,
  type SlotPatch,
  draftFromView,
  isPlanEmpty,
  planCoverSave,
  slotBlockers,
} from "@/lib/admin/sale-cover/cover-draft";
import type { CoverLotOption, CoverView } from "@/lib/admin/sale-cover/cover-view";
import { notify } from "@/lib/ui/notify";
import { SALE_COVER_SLOT_NAMES, type SaleCoverSlotName } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Args = { saleId: string; view: CoverView; lots: readonly CoverLotOption[] };

/**
 * The cover and home choices being edited: the draft, what has changed since it was loaded, what
 * stops it being saved yet, and the save itself. The page's saved state follows the server, so a
 * save that stops part-way leaves only the unsaved part marked as changed.
 */
export function useCoverDraft({ saleId, view, lots }: Args) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<CoverDraft>(() => draftFromView(view, lots));
  const [draft, setDraft] = useState<CoverDraft>(baseline);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setBaseline(draftFromView(view, lots));
  }, [view, lots]);

  const plan = useMemo(() => planCoverSave(view, baseline, draft), [view, baseline, draft]);
  const dirty = !isPlanEmpty(plan);

  const phoneSlotPresent = draft.slots.phone !== undefined;
  const blockers = useMemo(() => {
    const out: Partial<Record<SaleCoverSlotName, string[]>> = {};
    for (const name of SALE_COVER_SLOT_NAMES) {
      const slot = draft.slots[name];
      if (!slot) continue;
      const reasons = slotBlockers(name, slot, phoneSlotPresent);
      if (reasons.length > 0) out[name] = reasons;
    }
    return out;
  }, [draft.slots, phoneSlotPresent]);
  const blocked = Object.keys(blockers).length > 0;

  const setSlot = useCallback((name: SaleCoverSlotName, next: SlotDraft | null) => {
    setDraft((current) => {
      const slots = { ...current.slots };
      if (next) slots[name] = next;
      else delete slots[name];
      return { ...current, slots };
    });
  }, []);

  const patchSlot = useCallback((name: SaleCoverSlotName, patch: SlotPatch) => {
    setDraft((current) => {
      const slot = current.slots[name];
      if (!slot) return current;
      const merged = { ...slot, ...patch } as SlotDraft;
      // An explicit undefined clears an optional value (keep area, overrides).
      for (const key of ["keep", "toneOverride", "sideOverride"] as const) {
        if (key in patch && patch[key] === undefined) delete merged[key];
      }
      return { ...current, slots: { ...current.slots, [name]: merged } };
    });
  }, []);

  const patchHome = useCallback((patch: Partial<HomeDraft>) => {
    setDraft((current) => ({ ...current, home: { ...current.home, ...patch } }));
  }, []);

  const discard = useCallback(() => {
    setDraft(baseline);
    setSaveError(null);
  }, [baseline]);

  const save = useCallback(async () => {
    if (!dirty || blocked || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await adminSaveSaleCoverAction(saleId, plan);
      if (result.ok) {
        notify.success("Cover and home saved");
      } else {
        setSaveError(result.error);
      }
      // Parts saved before a failure stay saved, so the page is read again either way.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [blocked, dirty, plan, router, saleId, saving]);

  return {
    draft,
    baseline,
    dirty,
    saving,
    saveError,
    blockers,
    blocked,
    setSlot,
    patchSlot,
    patchHome,
    discard,
    save,
  };
}
