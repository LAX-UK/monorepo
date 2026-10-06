import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type ShopNoticeTone = "success" | "info" | "warning" | "error";

export type ShopNoticeProps = {
  tone: ShopNoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
  /** When set, renders a dismiss control beside the body. */
  onDismiss?: () => void;
  dismissLabel?: string;
};

export function ShopNotice({
  tone,
  title,
  children,
  className,
  onDismiss,
  dismissLabel = "Dismiss",
}: ShopNoticeProps) {
  const role = tone === "error" ? "alert" : "status";

  return (
    <div role={role} className={cn("shop-notice", `shop-notice--${tone}`, className)}>
      <div className="shop-notice__inner">
        <div className="shop-notice__content">
          {title ? <p className="shop-notice__title">{title}</p> : null}
          <div className="shop-notice__body">{children}</div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="shop-notice__dismiss shop-focus-ring"
            onClick={onDismiss}
          >
            {dismissLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
