export type WizardStepSpec = {
  id: string;
  label: string;
  /** Optional per-step time hint, e.g. 1 for "1 min" */
  estimatedMinutes?: number;
  /** Figma sub-section labels (e.g. Details / Media / Discovery). */
  subItems?: readonly string[];
  /** Muted helper line shown under inactive/future steps. */
  description?: string;
};
