"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options<TInspect> = {
  collectionLength: number;
  inspectTarget: TInspect | null;
  setInspectTarget: (target: TInspect | null) => void;
};

/** Headless add/manage/inspect controller shared by catalog media tab boards. */
export function useMediaCollectionUi<TInspect>({
  collectionLength,
  inspectTarget,
  setInspectTarget,
}: Options<TInspect>) {
  const [showAdd, setShowAdd] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const addPanelRef = useRef<HTMLDivElement>(null);
  const previousLengthRef = useRef(collectionLength);

  useEffect(() => {
    if (showAdd && addPanelRef.current) {
      const focusTarget = addPanelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusTarget?.focus();
    }
  }, [showAdd]);

  useEffect(() => {
    if (showAdd && collectionLength > previousLengthRef.current) {
      setShowAdd(false);
      addButtonRef.current?.focus();
    }
    previousLengthRef.current = collectionLength;
  }, [collectionLength, showAdd]);

  const closeAddPanel = useCallback(() => {
    setShowAdd(false);
    addButtonRef.current?.focus();
  }, []);

  const closeInspector = useCallback(() => {
    setInspectTarget(null);
  }, [setInspectTarget]);

  const toggleAdd = useCallback(() => {
    setShowAdd((open) => !open);
  }, []);

  const toggleManage = useCallback(() => {
    setShowManage((open) => {
      if (open) {
        setInspectTarget(null);
        queueMicrotask(() => manageButtonRef.current?.focus());
      }
      return !open;
    });
  }, [setInspectTarget]);

  return {
    showAdd,
    setShowAdd,
    showManage,
    setShowManage,
    addButtonRef,
    manageButtonRef,
    addPanelRef,
    closeAddPanel,
    closeInspector,
    toggleAdd,
    toggleManage,
    inspectTarget,
  };
}
