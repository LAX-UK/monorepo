import { LaxLogo } from "@/components/layout/lax-logo";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  children: ReactNode;
  /** Optional full-bleed background image (blurred). */
  backgroundSrc?: string;
};

export function AuthLayout({ title, children, backgroundSrc }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white pt-[114px] pb-16">
      {backgroundSrc ? (
        <div
          className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-30 blur-md"
          style={{ backgroundImage: `url(${backgroundSrc})` }}
          aria-hidden
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(5,5,5,0.07),transparent)]"
          aria-hidden
        />
      )}
      <div className="relative mx-auto flex w-full max-w-[528px] flex-col items-center gap-12 px-6 pb-20 pt-16 md:pt-20">
        <LaxLogo variant="auth" className="shrink-0" />
        <div className="flex w-full flex-col gap-10">
          <h1 className="w-full text-center font-artists-serif text-3xl font-semibold uppercase leading-none tracking-[0.5px] text-brand-900 md:text-[40px]">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}
