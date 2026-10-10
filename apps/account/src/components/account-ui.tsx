import type { ReactNode } from "react";

export function AccountShell({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <header className="border-b border-outline bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <a href="/" className="text-sm font-semibold tracking-[0.2em] uppercase">
            LAX <span className="font-normal text-on-surface-variant">Account</span>
          </a>
          {actions}
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-3xl px-6 pb-8 text-xs text-on-surface-variant">
        One account for LAX Bid, LAX Shop and every LAX product.
      </footer>
    </div>
  );
}

export function Card({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="rounded-lg border border-outline bg-surface p-6"
    >
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-on-surface-variant">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Row({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-outline py-4 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
          {label}
        </dt>
        <dd className="text-sm break-words">{children}</dd>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "muted"; children: ReactNode }) {
  return (
    <span
      className={
        tone === "ok"
          ? "ml-2 inline-flex items-center rounded-full bg-success-container px-2 py-0.5 text-xs font-medium text-success"
          : "ml-2 inline-flex items-center rounded-full border border-outline px-2 py-0.5 text-xs text-on-surface-variant"
      }
    >
      {children}
    </span>
  );
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90";

export const primaryButton = `${buttonBase} bg-primary text-on-primary`;
export const secondaryButton = `${buttonBase} border border-outline bg-surface text-on-surface`;
export const textLink = "text-sm font-medium text-link underline-offset-4 hover:underline";

export function Notice({
  tone,
  title,
  children,
}: {
  tone: "info" | "error";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-lg border border-error/40 bg-error-container p-4 text-sm"
          : "rounded-lg border border-outline bg-info-container p-4 text-sm"
      }
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-on-surface-variant">{children}</p>
    </div>
  );
}
