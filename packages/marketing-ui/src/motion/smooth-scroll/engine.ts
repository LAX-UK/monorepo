export type ScrollTarget = number | string | HTMLElement;

export type ScrollToOptions = {
  offset?: number;
  immediate?: boolean;
};

export interface SmoothScrollEngine {
  scrollTo(target: ScrollTarget, options?: ScrollToOptions): Promise<void>;
  sync(): void;
  stop(): void;
  start(): void;
  destroy(): void;
}

export type SmoothScrollEngineFactory = () => SmoothScrollEngine;
