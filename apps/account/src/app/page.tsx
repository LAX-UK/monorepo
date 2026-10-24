import signInGallery from "@/assets/signin-gallery.webp";
import { Button } from "@/components/account-button";
import { NOTICE, NoticeTitle } from "@/components/account-ui";
import { ProductName } from "@/components/product-name";
import { AccountFooter } from "@/components/shell/account-frame";
import { AccountThemeToggle } from "@/components/shell/account-theme-toggle.client";
import { SignInProducts } from "@/components/sign-in-products";
import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildAccountProducts } from "@/server/domain/account-products.vm";
import { signInNotice } from "@/server/domain/sign-in-notice.vm";
import { LaxLockup } from "@auction/marketing-ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const LOGIN_HREF = "/api/auth/login?returnTo=/account";

/** `next/image` hands back an object; Vite, in tests, hands back the URL. */
const galleryUrl = typeof signInGallery === "string" ? signInGallery : signInGallery.src;

/**
 * Sign-in: the panel on the left and a gallery painting on the right, the way Art and Shop open
 * their own sign-up. On a phone the painting becomes a short banner above the panel.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const notice = signInNotice(error);
  const session = await loadAccountSession();
  if (session.status === "ok" && !notice) redirect("/account");

  const { config } = getLaxAccountContainer();
  const products = buildAccountProducts(config);
  const { support } = buildAccountLinks(config);

  return (
    <div className="flex min-h-screen flex-col bg-page-bg lg:grid lg:grid-cols-2">
      {/* The painting is decoration: the headline says everything the page means. */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-surface-container sm:h-56 lg:order-2 lg:h-auto">
        <img
          src={galleryUrl}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[50%_40%]"
        />
      </div>

      <div className="flex flex-1 flex-col lg:order-1">
        <div className="flex items-center justify-between px-4 pt-6 sm:px-10 lg:px-16 lg:pt-10">
          <a href="/" className="flex min-h-11 items-center rounded-sm">
            <LaxLockup kind="account" className="block h-9 w-auto sm:h-10" />
          </a>
          <AccountThemeToggle />
        </div>

        <main
          id="main"
          className="flex flex-1 flex-col justify-center gap-8 px-4 py-10 sm:px-10 lg:px-16"
        >
          <div className="flex max-w-lg flex-col gap-4">
            <h1 className="font-headline text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              One account for all of LAX
            </h1>
            <p className="text-base leading-7 text-on-surface-variant">
              Sign in once to manage your details, security and works across{" "}
              <ProductName product="bid">Bid</ProductName>,{" "}
              <ProductName product="shop">Shop</ProductName> and{" "}
              <ProductName product="art">Art</ProductName>.
            </p>
          </div>
          {notice ? (
            <Alert
              variant={notice.tone === "error" ? "destructive" : "default"}
              role={notice.tone === "error" ? "alert" : "status"}
              className={`max-w-lg ${NOTICE}`}
            >
              <NoticeTitle>{notice.title}</NoticeTitle>
              <AlertDescription className="text-on-surface-variant">
                {notice.message}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex max-w-lg flex-col gap-4">
            <Button
              asChild
              variant="cta"
              size="lg"
              className="min-h-12 w-full sm:w-auto sm:self-start sm:px-10"
            >
              <a href={LOGIN_HREF}>{notice ? "Try signing in again" : "Sign in"}</a>
            </Button>
            <p className="flex flex-wrap items-center gap-x-1 text-sm text-on-surface-variant">
              New to LAX?
              <a
                href={LOGIN_HREF}
                className="inline-flex min-h-11 items-center rounded-sm font-medium text-on-surface underline underline-offset-4"
              >
                Create an account
              </a>
            </p>
          </div>
          <SignInProducts products={products} />
        </main>

        <div className="px-4 sm:px-10 lg:px-16">
          <AccountFooter support={support} bare />
        </div>
      </div>
    </div>
  );
}
