import type { SVGProps } from "react";

type IllustrationProps = SVGProps<SVGSVGElement>;

function IllustrationFrame({ children, className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Decorative only — aria-hidden, so no <title>: it would be ignored by
          screen readers but read as the page title by crawlers that take the
          document's first <title>. */}
      {children}
    </svg>
  );
}

/** Empty search / filter results */
function EmptySearchIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <circle cx="44" cy="36" r="18" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <path
        d="M56 48 L72 64"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M28 58 L92 58"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.25"
      />
    </IllustrationFrame>
  );
}

/** Empty queue / inbox */
function EmptyQueueIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <rect
        x="28"
        y="18"
        width="64"
        height="44"
        rx="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <path
        d="M40 32 H80 M40 42 H68 M40 52 H56"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </IllustrationFrame>
  );
}

/** Empty payments / money */
function EmptyPaymentsIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <rect
        x="30"
        y="24"
        width="60"
        height="36"
        rx="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <circle cx="60" cy="42" r="10" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <path
        d="M56 42 H64 M60 38 V46"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </IllustrationFrame>
  );
}

/** Empty users / clients */
function EmptyUsersIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <circle cx="48" cy="34" r="10" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <circle cx="72" cy="38" r="8" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M32 58 C32 48 40 44 48 44 C56 44 64 48 64 58 M58 58 C58 50 64 46 72 46 C80 46 88 50 88 58"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </IllustrationFrame>
  );
}

/** Empty lots / catalogue */
function EmptyLotsIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <rect
        x="32"
        y="20"
        width="28"
        height="36"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <rect
        x="44"
        y="26"
        width="28"
        height="36"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
      />
      <rect
        x="56"
        y="32"
        width="28"
        height="36"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.5"
      />
    </IllustrationFrame>
  );
}

/** Empty sales / calendar */
function EmptySalesIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <rect
        x="30"
        y="22"
        width="60"
        height="44"
        rx="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <path d="M30 34 H90" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <circle cx="44" cy="48" r="4" fill="currentColor" opacity="0.25" />
      <circle cx="60" cy="48" r="4" fill="currentColor" opacity="0.35" />
      <circle cx="76" cy="48" r="4" fill="currentColor" opacity="0.2" />
    </IllustrationFrame>
  );
}

/** Empty press / news archive */
function EmptyPressIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <rect
        x="24"
        y="16"
        width="72"
        height="48"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <path
        d="M34 28 H86 M34 38 H74 M34 48 H58"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle cx="78" cy="52" r="12" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <path
        d="M86 60 L96 70"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.45"
      />
    </IllustrationFrame>
  );
}

/** Route error — subtle broken frame */
function ErrorIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <rect
        x="32"
        y="18"
        width="56"
        height="44"
        rx="6"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <path
        d="M44 32 L76 48 M76 32 L44 48"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </IllustrationFrame>
  );
}

/** 404 — empty catalogue / saleroom frame */
function NotFoundIllustration(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <rect
        x="36"
        y="22"
        width="48"
        height="36"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <path
        d="M48 58 L72 58"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M54 34 L66 34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.25"
      />
      <circle cx="60" cy="44" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </IllustrationFrame>
  );
}

export type EmptyStateIllustrationKey =
  | "search"
  | "queue"
  | "payments"
  | "users"
  | "lots"
  | "sales"
  | "press"
  | "error"
  | "notFound";

const ILLUSTRATIONS: Record<
  EmptyStateIllustrationKey,
  (props: IllustrationProps) => React.JSX.Element
> = {
  search: EmptySearchIllustration,
  queue: EmptyQueueIllustration,
  payments: EmptyPaymentsIllustration,
  users: EmptyUsersIllustration,
  lots: EmptyLotsIllustration,
  sales: EmptySalesIllustration,
  press: EmptyPressIllustration,
  error: ErrorIllustration,
  notFound: NotFoundIllustration,
};

const DEFAULT_CLASS = "mx-auto h-16 w-24 text-on-surface-variant/50";

export function EmptyStateIllustration({
  name,
  className,
}: {
  name: EmptyStateIllustrationKey;
  className?: string;
}) {
  const Component = ILLUSTRATIONS[name];
  return <Component className={className ?? DEFAULT_CLASS} />;
}
