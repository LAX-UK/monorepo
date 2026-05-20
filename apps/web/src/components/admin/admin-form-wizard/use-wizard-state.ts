"use client";

import { useCallback, useReducer } from "react";

export type WizardState = {
  stepIndex: number;
  dirty: boolean;
};

export type WizardAction =
  | { type: "goNext" }
  | { type: "goPrev" }
  | { type: "goTo"; index: number }
  | { type: "setDirty"; dirty: boolean };

function clampStep(index: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.max(0, Math.min(index, stepCount - 1));
}

function wizardReducer(state: WizardState, action: WizardAction, stepCount: number): WizardState {
  switch (action.type) {
    case "goNext":
      return { ...state, stepIndex: clampStep(state.stepIndex + 1, stepCount) };
    case "goPrev":
      return { ...state, stepIndex: clampStep(state.stepIndex - 1, stepCount) };
    case "goTo":
      return { ...state, stepIndex: clampStep(action.index, stepCount) };
    case "setDirty":
      return { ...state, dirty: action.dirty };
    default:
      return state;
  }
}

export function useWizardState(stepCount: number, initialStepIndex = 0) {
  const [state, dispatchBase] = useReducer(
    (s: WizardState, a: WizardAction) => wizardReducer(s, a, stepCount),
    { stepIndex: clampStep(initialStepIndex, stepCount), dirty: false },
  );

  const goNext = useCallback(() => dispatchBase({ type: "goNext" }), []);
  const goPrev = useCallback(() => dispatchBase({ type: "goPrev" }), []);
  const goTo = useCallback((index: number) => dispatchBase({ type: "goTo", index }), []);
  const setDirty = useCallback((dirty: boolean) => dispatchBase({ type: "setDirty", dirty }), []);

  const isFirst = state.stepIndex <= 0;
  const isLast = stepCount <= 0 || state.stepIndex >= stepCount - 1;

  return {
    stepIndex: state.stepIndex,
    dirty: state.dirty,
    isFirst,
    isLast,
    goNext,
    goPrev,
    goTo,
    setDirty,
  };
}
