import { ONE_ACCOUNT_MESSAGE } from "@/lib/account-copy";
import { LaxLockup } from "@auction/marketing-ui";
import type { ReactNode } from "react";

/** Figma draws mobile only (390); wider screens keep the same content in a centred column. */
export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <header className="border-b border-border-hairline bg-surface">
        <div className="mx-auto flex h-24 max-w-2xl items-center px-4 sm:px-6">
          <a href="/" className="flex min-h-11 items-center">
            {/* 64px tall in a 96px header (16px above and below) puts the ".ACCOUNT" capitals at 10.5px, the smallest size that stays legible. */}
            <LaxLockup kind="account" className="block h-16 w-auto" />
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
        {ONE_ACCOUNT_MESSAGE}
      </footer>
    </div>
  );
}
