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
  rootMargin: "0px",
  threshold: 0,
};

function isElementInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return rect.bottom > 0 && rect.top < vh;
}

export function inViewTrigger(options?: IntersectionObserverInit): RevealTrigger {
  return {
    id: "in-view",
    bind: (el, onReveal) => {
      if (typeof IntersectionObserver === "undefined") {
        onReveal();
        return () => {};
      }
      let revealed = false;
      const revealOnce = () => {
        if (revealed) return;
        revealed = true;
        onReveal();
      };
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              revealOnce();
              io.unobserve(e.target);
            }
          }
        },
        { ...defaultInViewOptions, ...options },
      );
      io.observe(el);
      if (isElementInViewport(el)) {
        revealOnce();
        io.unobserve(el);
      }
      return () => io.disconnect();
    },
  };
}

/** Stable default for scroll-triggered reveals (module singleton). */
export const defaultInViewTrigger = inViewTrigger();
