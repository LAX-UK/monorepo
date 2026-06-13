import { AuthContentReveal } from "@/components/auth/auth-content-reveal";
import { LaxLogo } from "@/components/layout/lax-logo";
import { DisplayHeading } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
  title: string;
  description?: string;
  /** Optional full-bleed background image (blurred). */
  backgroundSrc?: string;
  /** `task` = under `(task)/layout` shell (no bottom browse link; header is back-to-gallery only). */
  chrome?: "standalone" | "task";
};

export function AuthLayout({
  children,
  title,
  description,
  backgroundSrc,
  chrome = "standalone",
}: AuthLayoutProps) {
  const isTask = chrome === "task";

  const formBody = (
    <div className="w-full">
      <AuthContentReveal>{children}</AuthContentReveal>
    </div>
  );

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-page-bg pb-16 dark:bg-background">
      {backgroundSrc ? (
        <div
          className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-30 blur-md"
          style={{ backgroundImage: `url(${backgroundSrc})` }}
          aria-hidden
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--color-scrim-auth),transparent)]"
          aria-hidden
        />
      )}
      <div
        className={`relative mx-auto flex w-full max-w-[var(--auth-column,528px)] flex-col items-center px-6 pb-20 ${
          isTask ? "gap-8 pt-8 sm:pt-12" : "gap-12 pt-16 md:pt-20"
        }`}
      >
        <LaxLogo variant="auth" className="shrink-0" />
        <div className="flex flex-col items-center gap-3 text-center">
          <DisplayHeading as="h1" size="section" className="font-semibold uppercase tracking-tight">
            {title}
          </DisplayHeading>
          {description ? (
            <p className="max-w-md font-body text-sm leading-6 text-on-surface-variant">
              {description}
            </p>
          ) : null}
        </div>
        {isTask ? (
          <Surface variant="section" padding="md" className="w-full border-border-hairline">
            {formBody}
          </Surface>
        ) : (
          formBody
        )}
        {!isTask ? (
          <p className="text-center font-body text-sm text-on-surface-variant">
            <Link href="/search" className="text-link underline-offset-4 hover:underline">
              Browse catalogue
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
