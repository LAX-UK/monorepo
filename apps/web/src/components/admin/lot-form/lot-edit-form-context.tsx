"use client";

import { confirmWithMessage } from "@/components/admin/dirty-navigation-registry";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Control, useFormState } from "react-hook-form";

export type LotEditSectionId = "auction" | "catalog";

type LotEditFormContextValue = {
  activeSection: LotEditSectionId | "documents";
  confirmLeaveActiveSection: () => Promise<boolean>;
  registerSectionDirty: (section: LotEditSectionId, dirty: boolean) => void;
};

const LotEditFormContext = createContext<LotEditFormContextValue | null>(null);

type ProviderProps = {
  activeSection: LotEditSectionId | "documents";
  children: ReactNode;
};

/** One dirty guard for the lot edit page; child forms report section-scoped dirty state. */
export function LotEditFormProvider({ activeSection, children }: ProviderProps) {
  const [dirtySections, setDirtySections] = useState<ReadonlySet<LotEditSectionId>>(
    () => new Set(),
  );
  const dirtySectionsRef = useRef(dirtySections);
  dirtySectionsRef.current = dirtySections;

  const registerSectionDirty = useCallback((section: LotEditSectionId, dirty: boolean) => {
    setDirtySections((prev) => {
      const has = prev.has(section);
      if (dirty && has) return prev;
      if (!dirty && !has) return prev;
      const next = new Set(prev);
      if (dirty) next.add(section);
      else next.delete(section);
      return next;
    });
  }, []);

  const confirmLeaveActiveSection = useCallback(async () => {
    if (activeSection === "documents") return true;
    if (!dirtySectionsRef.current.has(activeSection)) return true;
    return confirmWithMessage("You have unsaved changes. Switch section anyway?");
  }, [activeSection]);

  const hasAnyDirty = dirtySections.size > 0;

  const value = useMemo(
    (): LotEditFormContextValue => ({
      activeSection,
      confirmLeaveActiveSection,
      registerSectionDirty,
    }),
    [activeSection, confirmLeaveActiveSection, registerSectionDirty],
  );

  return (
    <LotEditFormContext.Provider value={value}>
      <FormDirtyGuard isDirty={hasAnyDirty} />
      {children}
    </LotEditFormContext.Provider>
  );
}

export function useLotEditFormContext(): LotEditFormContextValue | null {
  return useContext(LotEditFormContext);
}

/** Registers dirty state for a lot-edit section (auction or catalog). */
export function useLotEditSectionDirty(section: LotEditSectionId, isDirty: boolean): void {
  const registerSectionDirty = useContext(LotEditFormContext)?.registerSectionDirty;
  useEffect(() => {
    if (!registerSectionDirty) return;
    registerSectionDirty(section, isDirty);
    return () => registerSectionDirty(section, false);
  }, [registerSectionDirty, section, isDirty]);
}

/**
 * Subscribes to lot form dirty state without re-rendering the full form tree.
 * Reports auction-section dirty state to {@link LotEditFormProvider}.
 */
export function LotEditDirtyReporter({
  control,
  lotEditSection,
  onWizardDirtyChange,
}: {
  control: Control<AdminLotFormValues>;
  lotEditSection?: LotEditSectionId;
  onWizardDirtyChange?: (isDirty: boolean) => void;
}) {
  const { isDirty } = useFormState({ control });
  useLotEditSectionDirty("auction", Boolean(lotEditSection === "auction" && isDirty));
  useEffect(() => {
    onWizardDirtyChange?.(isDirty);
  }, [isDirty, onWizardDirtyChange]);
  return null;
}
