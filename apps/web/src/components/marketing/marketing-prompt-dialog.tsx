"use client";

import { useAuthHeaderLinks } from "@/lib/auth/use-auth-header-links";
import type { MarketingPromptVariant } from "@/lib/marketing/prompts/types";
import { sellIntakeHref, sellRegisterHref } from "@/lib/marketing/sell-intake";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import Image from "next/image";
import Link from "next/link";

const CONTENT = {
  selling: {
    title: "Have something special to sell?",
    description: "Tell us a little about it and our specialists can help you explore your options.",
    cta: "Explore selling",
    image: "/images/marketing-prompts/selling.webp",
    imageAvif: "/images/marketing-prompts/selling.avif",
    imageAlt: "",
  },
  signup: {
    title: "Discover art worth collecting",
    description:
      "Discover exceptional art, follow artists, and find pieces worth collecting, all in one place.",
    cta: "Sign up",
    image: "/images/marketing-prompts/signup.webp",
    imageAvif: "/images/marketing-prompts/signup.avif",
    imageAlt: "",
  },
} as const;

export function MarketingPromptDialog({
  open,
  variant,
  isAuthenticated,
  onDismiss,
  onCta,
}: {
  open: boolean;
  variant: MarketingPromptVariant;
  isAuthenticated: boolean;
  onDismiss: () => void;
  onCta: () => void;
}) {
  const authLinks = useAuthHeaderLinks();
  const content = CONTENT[variant];
  const primaryHref =
    variant === "selling"
      ? isAuthenticated
        ? sellIntakeHref()
        : sellRegisterHref()
      : authLinks.registerHref;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
    >
      <DialogContent
        data-testid="marketing-prompt-dialog"
        data-variant={variant}
        className="!top-auto !right-0 !bottom-0 !left-0 grid max-h-[min(92svh,48rem)] !w-auto !max-w-none !translate-x-0 !translate-y-0 grid-cols-1 gap-0 overflow-y-auto rounded-t-2xl border-outline-variant/50 bg-surface-container-lowest p-0 shadow-2xl motion-reduce:duration-0 sm:!top-1/2 sm:!right-auto sm:!bottom-auto sm:!left-1/2 sm:max-h-[min(86vh,40rem)] sm:!w-[min(64rem,calc(100vw-3rem))] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:grid-cols-[minmax(0,45%)_minmax(0,55%)] sm:overflow-hidden sm:rounded-lg"
        overlayClassName="bg-black/50 motion-reduce:duration-0"
        overlayProps={{ onClick: onDismiss }}
        onPointerDownOutside={(event) => event.preventDefault()}
        closeClassName="top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-on-surface text-surface-container-lowest opacity-100 shadow-md hover:bg-on-surface/85 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:top-4 sm:right-4 [&_svg]:size-5"
      >
        <div className="order-last flex flex-col items-start justify-center px-6 py-7 pr-14 sm:order-first sm:min-h-[27.5rem] sm:px-10 sm:py-10 sm:pr-12">
          <DialogTitle className="max-w-md text-left font-headline text-[2rem] leading-[1.12] font-medium tracking-tight text-on-surface sm:text-[2.75rem] sm:leading-[1.16]">
            {content.title}
          </DialogTitle>
          <DialogDescription className="mt-4 max-w-md text-left font-body text-base leading-relaxed text-on-surface sm:mt-6 sm:text-lg sm:leading-[1.625rem]">
            {content.description}
          </DialogDescription>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-on-surface bg-transparent font-body text-sm font-semibold text-on-surface shadow-none hover:bg-surface-container-low sm:text-base"
            >
              <Link href={primaryHref} onClick={onCta}>
                {content.cta}
              </Link>
            </Button>
            {variant === "signup" ? (
              <Button asChild variant="link" size="link" className="font-body text-sm">
                <Link href={authLinks.signInHref} onClick={onCta}>
                  Sign in
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative order-first h-44 overflow-hidden bg-surface-container-low sm:order-last sm:h-full sm:min-h-[27.5rem]">
          <picture>
            <source srcSet={content.imageAvif} type="image/avif" />
            <Image
              src={content.image}
              alt={content.imageAlt}
              fill
              sizes="(max-width: 639px) 100vw, 55vw"
              loading="lazy"
              className="object-cover"
            />
          </picture>
        </div>
      </DialogContent>
    </Dialog>
  );
}
