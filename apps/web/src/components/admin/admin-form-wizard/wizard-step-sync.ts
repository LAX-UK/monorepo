"use client";

import { useSyncExternalStore } from "react";

export type WizardMobilePrimaryAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export type WizardMobileCancelAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export type WizardStepSnapshot = {
  stepIndex: number;
  stepCount: number;
  isLast: boolean;
  pending: boolean;
  active: boolean;
  /** True when the mounted wizard registered a Continue handler. */
  canAdvance: boolean;
  /** Overrides form submit on the mobile bar when set (e.g. sale setup publish). */
  primaryAction: WizardMobilePrimaryAction | null;
  /** Overrides static cancel href when set (e.g. save draft before exit). */
  cancelAction: WizardMobileCancelAction | null;
};

export type WizardStepOwner = symbol;

const defaultSnapshot: WizardStepSnapshot = {
  stepIndex: 0,
  stepCount: 1,
  isLast: true,
  pending: false,
  active: false,
  canAdvance: false,
  primaryAction: null,
  cancelAction: null,
};

let snapshot: WizardStepSnapshot = defaultSnapshot;
let currentOwner: WizardStepOwner | null = null;
let mobileNavigation: { requestNext: () => void | Promise<void> } | null = null;
let mobileNavigationOwner: WizardStepOwner | null = null;
let mobilePrimaryAction: WizardMobilePrimaryAction | null = null;
let mobilePrimaryOwner: WizardStepOwner | null = null;
let mobileCancelAction: WizardMobileCancelAction | null = null;
let mobileCancelOwner: WizardStepOwner | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Create a unique owner token for a single wizard instance. */
export function createWizardStepOwner(): WizardStepOwner {
  return Symbol("wizardStep");
}

/**
 * Publish the active wizard's step snapshot. The first wizard to publish in
 * a given page claims ownership; later publishes from a different owner take
 * over (last mount wins, matching what the user is currently looking at).
 */
export function publishWizardStep(
  owner: WizardStepOwner,
  next: Partial<WizardStepSnapshot> & { stepCount: number },
): void {
  currentOwner = owner;
  const stepIndex = next.stepIndex ?? snapshot.stepIndex;
  snapshot = {
    ...snapshot,
    ...next,
    stepIndex,
    isLast: stepIndex >= next.stepCount - 1,
    active: true,
    canAdvance: mobileNavigationOwner === owner && mobileNavigation != null,
    primaryAction: mobilePrimaryOwner === owner ? mobilePrimaryAction : null,
    cancelAction: mobileCancelOwner === owner ? mobileCancelAction : null,
  };
  emit();
}

/** Lets the mobile bar invoke a custom primary action instead of form submit. */
export function registerWizardMobilePrimary(
  owner: WizardStepOwner,
  action: WizardMobilePrimaryAction | null,
): void {
  mobilePrimaryOwner = action ? owner : null;
  mobilePrimaryAction = action;
  if (currentOwner === owner) {
    snapshot = { ...snapshot, primaryAction: action };
    emit();
  }
}

/** Lets the mobile bar save-before-exit or use a custom cancel handler. */
export function registerWizardMobileCancel(
  owner: WizardStepOwner,
  action: WizardMobileCancelAction | null,
): void {
  mobileCancelOwner = action ? owner : null;
  mobileCancelAction = action;
  if (currentOwner === owner) {
    snapshot = { ...snapshot, cancelAction: action };
    emit();
  }
}

/** Lets the mobile action bar call the same Continue handler as desktop. */
export function registerWizardMobileNavigation(
  owner: WizardStepOwner,
  nav: { requestNext: () => void | Promise<void> } | null,
): void {
  mobileNavigationOwner = nav ? owner : null;
  mobileNavigation = nav;
  if (currentOwner === owner) {
    snapshot = { ...snapshot, canAdvance: nav != null };
    emit();
  }
}

export function invokeWizardNext(): void {
  if (mobileNavigation) void mobileNavigation.requestNext();
}

/**
 * Reset the snapshot only when our owner still holds the store. This avoids
 * the step-change flicker: re-running cleanup on every step change used to
 * briefly set `active = false`, hiding the mobile submit bar.
 */
export function resetWizardStepSync(owner: WizardStepOwner): void {
  if (currentOwner !== owner) return;
  snapshot = defaultSnapshot;
  currentOwner = null;
  if (mobileNavigationOwner === owner) {
    mobileNavigationOwner = null;
    mobileNavigation = null;
  }
  if (mobilePrimaryOwner === owner) {
    mobilePrimaryOwner = null;
    mobilePrimaryAction = null;
  }
  if (mobileCancelOwner === owner) {
    mobileCancelOwner = null;
    mobileCancelAction = null;
  }
  emit();
}

export function useWizardStepSync(): WizardStepSnapshot {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => snapshot,
    () => defaultSnapshot,
  );
}
