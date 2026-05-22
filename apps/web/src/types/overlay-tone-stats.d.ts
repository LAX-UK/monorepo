declare global {
  interface Window {
    __overlayToneStats?: { samples: number; cacheHits: number; opaqueFallbacks: number };
  }
}

export {};
