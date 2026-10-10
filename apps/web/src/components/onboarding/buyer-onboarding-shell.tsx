import { LaxLogo } from "@/components/layout/lax-logo";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  progress?: 1 | 2 | 3 | undefined;
  backHref?: string | undefined;
  width?: "standard" | "identity";
  children: ReactNode;
};

export function BuyerOnboardingShell({
  title,
  description,
  progress,
  backHref,
  width = "standard",
  children,
}: Props) {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 font-body text-on-surface sm:px-8 sm:py-5"
    >
      <div
        className={`relative mx-auto flex w-full flex-col items-center gap-6 sm:gap-8 ${
          width === "identity" ? "max-w-[855px]" : "max-w-[1000px]"
        }`}
      >
        <LaxLogo
          variant="auth"
          className="h-14 justify-center [&_.lax-logo-img]:max-h-14 sm:h-16 sm:[&_.lax-logo-img]:max-h-16"
        />
        <header className="relative flex w-full flex-col items-center gap-5 text-center sm:gap-6">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="Go back"
              className={`absolute top-1 flex size-8 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
                width === "identity" ? "left-0 lg:left-[-72.5px]" : "left-0"
              }`}
            >
              <Image
                src="/images/onboarding/identity/arrow-back.svg"
                alt=""
                width={21.333}
                height={21.333}
                aria-hidden
              />
            </Link>
          ) : null}
          <div className="flex w-full flex-col items-center gap-2.5 px-9 sm:gap-3 sm:px-10">
            <h1 className="text-balance font-body text-[26px] font-medium uppercase leading-[1.05] tracking-[0.5px] sm:text-[34px]">
              {title}
            </h1>
            {description ? (
              <div className="text-pretty text-base font-normal leading-6 text-on-surface-variant sm:text-[17px]">
                {description}
              </div>
            ) : null}
          </div>
          {progress ? (
            <>
              <div className="h-0.5 w-[214px] bg-surface-container-high sm:w-[300px]" aria-hidden>
                <div
                  className="h-full bg-secondary"
                  style={{ width: `${progress === 1 ? 31.33 : progress === 2 ? 65.67 : 79}%` }}
                />
              </div>
              <span className="sr-only">Onboarding step {progress} of 3</span>
            </>
          ) : null}
        </header>
        <div className="flex w-full flex-col items-center gap-8 sm:gap-10">{children}</div>
      </div>
    </main>
  );
}

export const onboardingPrimaryButton =
  "inline-flex min-h-14 min-w-[140px] items-center justify-center gap-2 rounded-md bg-secondary px-6 py-4 text-base font-medium leading-6 text-on-secondary shadow-none transition-[background-color,box-shadow,transform] duration-200 hover:bg-secondary/90 hover:shadow-md active:translate-y-px disabled:pointer-events-none disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary";

export const onboardingTextButton =
  "inline-flex min-h-14 items-center justify-center rounded-md bg-transparent px-3 py-4 text-base font-medium leading-6 text-secondary shadow-none transition-colors hover:bg-secondary/[0.06] hover:text-secondary disabled:pointer-events-none disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:px-4";

export const onboardingActions =
  "flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between";
