import type { ReactNode } from "react";

export type BidBlockerTone = "info" | "warning" | "danger" | "neutral";

export type BidBlockerAction =
  | {
      kind: "link";
      href: string;
      label: string;
      shortLabel?: string;
    }
  | {
      kind: "email";
      email: string;
      next: string;
      label: string;
      shortLabel?: string;
    }
  | {
      kind: "panel";
      label: string;
      shortLabel?: string;
    }
  | {
      kind: "status";
      label: string;
      shortLabel?: string;
    };

export type BidBlockerPresentation = {
  tone: BidBlockerTone;
  title: string;
  detail: ReactNode;
  action?: BidBlockerAction;
  /** Optional interactive recovery content rendered inside the shared blocker shell. */
  content?: ReactNode;
  /**
   * Briefly preserves discoverability without rendering a disabled bid form.
   * Terminal restrictions intentionally omit this copy.
   */
  preview?: string;
};

/** Hard blockers hide the inert bid form and the position summary. */
export function isHardBidBlocker(presentation: BidBlockerPresentation): boolean {
  return presentation.preview == null;
}
