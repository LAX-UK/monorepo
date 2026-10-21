import type { ReactNode } from "react";

/** Figma draws mobile only (390); wider screens keep the same content in a centred column. */
export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <header className="border-b border-border-hairline bg-surface">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4 sm:px-6">
          <a
            href="/"
            className="font-label text-sm font-semibold tracking-[0.2em] text-on-surface uppercase"
          >
            LAX <span className="font-normal text-on-surface-variant">Account</span>
          </a>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10"
      >
        {children}
      </main>
      <footer className="mx-auto w-full max-w-2xl px-4 pb-8 text-xs text-on-surface-variant sm:px-6">
        One account for LAX Bid, LAX Art and every LAX product.
      </footer>
    </div>
  );
}
