import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { callbackErrorMessage, callbackErrorReference } from "@/lib/auth/callback-error-message";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";

export const metadata = shopPrivatePageTitle("Sign-in problem");

const breadcrumbs = [{ label: "Shop", href: "/" }, { label: "Sign in" }] as const;

type SignInErrorPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function SignInErrorPage({ searchParams }: SignInErrorPageProps) {
  const params = await searchParams;
  const reference = callbackErrorReference(typeof params.reason === "string" ? params.reason : "");
  const supportHref = `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Shop sign-in problem (${reference})`,
  )}`;

  return (
    <ShopAccountShell
      title="Sign-in problem"
      breadcrumbs={breadcrumbs}
      notice={{
        variant: "destructive",
        title: "We couldn’t sign you in",
        description: callbackErrorMessage(reference),
      }}
    >
      <ShopAccountBodyText>Try again, or keep browsing and sign in later.</ShopAccountBodyText>
      <ShopAccountLinkButton href="/login?returnTo=%2Faccount" label="Try again" />
      <ShopAccountLinkButton href="/" label="Return home" variant="outline" />
      <ShopAccountBodyText>
        Still stuck?{" "}
        <a href={supportHref} className="font-medium text-link underline underline-offset-2">
          Contact support
        </a>{" "}
        and quote reference <code className="font-mono">{reference}</code>.
      </ShopAccountBodyText>
    </ShopAccountShell>
  );
}
