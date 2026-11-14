import type { SupportLinksVm } from "@/server/domain/account-links";
import signInGallery from "@auction/branding/images/signin-gallery.webp";
import { LaxLockup } from "@auction/marketing-ui";
import type { CSSProperties, ReactNode } from "react";
import { AccountFooter } from "./shell/account-frame";
import { AccountThemeToggle } from "./shell/account-theme-toggle.client";

/** `next/image` hands back an object; Vite, in tests, hands back the URL. */
const galleryUrl = typeof signInGallery === "string" ? signInGallery : signInGallery.src;
const galleryStyle = { "--sign-in-gallery": `url("${galleryUrl}")` } as CSSProperties;

/**
 * The signed-out frame LAX Account shares with the issuer's sign-in pages: the panel on the left
 * (lockup and theme toggle, the content, then who provides the account), and a gallery painting
 * on the right from `lg`. Phones and tablets get the panel alone, so a form is the first thing
 * on screen and the keyboard never pushes it below a picture; the painting is a background set
 * only from `lg`, so they never download it.
 *
 * The painting fills its whole column, edge to edge (`cover`). The column is as tall as the
 * viewport and stays put while a long page scrolls, and its width is the layout's, so its size
 * follows the window alone and never the content beside it: no zoom or shift between pages.
 *
 * The issuer's pages cannot use React, so `packages/auth` draws the same frame in HTML from the
 * same tokens (`hosted-auth/html.ts`); keep the two in step.
 */
export function SignInSplit({
  support,
  children,
}: {
  support: SupportLinksVm | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-page-bg">
      <div className="flex min-w-0 flex-1 flex-col lg:max-w-[50%]">
        <header className="flex items-center justify-between px-4 pt-6 md:px-10 lg:px-16 lg:pt-10">
          <a href="/" className="flex min-h-11 items-center rounded-sm">
            <LaxLockup kind="account" className="block h-9 w-auto sm:h-10" />
          </a>
          <AccountThemeToggle />
        </header>
        <main
          id="main"
          className="flex flex-1 flex-col justify-center px-4 py-12 md:px-10 lg:px-16"
        >
          <div className="flex w-full max-w-md flex-col gap-8">{children}</div>
        </main>
        <div className="px-4 md:px-10 lg:px-16">
          <AccountFooter support={support} />
        </div>
      </div>
      {/* The painting is decoration: the panel says everything the page means. */}
      <div
        aria-hidden="true"
        data-testid="sign-in-painting"
        style={galleryStyle}
        className="sticky top-0 hidden h-screen flex-1 self-start bg-surface-container bg-cover bg-no-repeat [background-position:58%_40%] supports-[height:100dvh]:h-dvh lg:block lg:bg-(image:--sign-in-gallery)"
      />
    </div>
  );
}
