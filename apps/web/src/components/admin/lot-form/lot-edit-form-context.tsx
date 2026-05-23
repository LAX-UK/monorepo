"use client";

import { confirmWithMessage } from "@/components/admin/dirty-navigation-registry";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
    if (!dirtySections.has(activeSection)) return true;
    return confirmWithMessage("You have unsaved changes. Switch section anyway?");
  }, [activeSection, dirtySections]);

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
  const ctx = useContext(LotEditFormContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.registerSectionDirty(section, isDirty);
    return () => ctx.registerSectionDirty(section, false);
  }, [ctx, section, isDirty]);
}
