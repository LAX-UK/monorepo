import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { callbackErrorMessage } from "@/lib/auth/callback-error-message";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";

export const metadata = shopPrivatePageMetadata;

type SignInErrorPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function SignInErrorPage({ searchParams }: SignInErrorPageProps) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : "unknown";

  return (
    <ShopAccountShell
      title="Sign-in failed"
      notice={{
        variant: "destructive",
        title: "Could not complete sign-in",
        description: callbackErrorMessage(reason),
      }}
    >
      <ShopAccountBodyText>Try again or return home to keep browsing.</ShopAccountBodyText>
      <ShopAccountLinkButton href="/login?returnTo=%2Faccount" label="Try again" />
      <ShopAccountLinkButton href="/" label="Return home" variant="outline" />
    </ShopAccountShell>
  );
}
