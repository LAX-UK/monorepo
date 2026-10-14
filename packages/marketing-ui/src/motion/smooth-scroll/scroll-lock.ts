function isBodyScrollLocked(): boolean {
  if (typeof document === "undefined") return false;
  const body = document.body;
  if (body.hasAttribute("data-scroll-locked")) return true;
  const overflow = body.style.overflow;
  return overflow === "hidden" || overflow === "clip";
}

/** Notifies when document body scroll-lock state changes (dialogs, sheets). */
export function observeScrollLock(onChange: (locked: boolean) => void): () => void {
  if (typeof document === "undefined") return () => {};

  let last = isBodyScrollLocked();
  onChange(last);

  const check = () => {
    const next = isBodyScrollLocked();
    if (next === last) return;
    last = next;
    onChange(next);
  };

  const observer = new MutationObserver(check);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-scroll-locked", "style"],
  });

  return () => observer.disconnect();
}
