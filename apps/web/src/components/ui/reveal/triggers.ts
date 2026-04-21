export type RevealTrigger = {
  readonly id: string;
  bind(el: HTMLElement, onReveal: () => void): () => void;
};

export const eagerTrigger: RevealTrigger = {
  id: "eager",
  bind: (_el, onReveal) => {
    onReveal();
    return () => {};
  },
};

const defaultInViewOptions: IntersectionObserverInit = {
  rootMargin: "0px 0px -10% 0px",
  threshold: 0.12,
};

export function inViewTrigger(options?: IntersectionObserverInit): RevealTrigger {
  return {
    id: "in-view",
    bind: (el, onReveal) => {
      if (typeof IntersectionObserver === "undefined") {
        onReveal();
        return () => {};
      }
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            onReveal();
            io.unobserve(e.target);
          }
        }
      }, { ...defaultInViewOptions, ...options });
      io.observe(el);
      return () => io.disconnect();
    },
  };
}

/** Stable default for scroll-triggered reveals (module singleton). */
export const defaultInViewTrigger = inViewTrigger();
