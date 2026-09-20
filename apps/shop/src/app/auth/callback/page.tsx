import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { callbackErrorMessage } from "@/lib/auth/callback-error-message";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

type ShopCallbackPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ShopAuthCallbackPage({ searchParams }: ShopCallbackPageProps) {
  const params = await searchParams;
  if (params.error) {
    return (
      <ShopAccountShell
        title="Sign-in failed"
        notice={{
          variant: "destructive",
          title: "Could not complete sign-in",
          description: callbackErrorMessage(params.error),
        }}
      >
        <ShopAccountBodyText>Try again or return home to keep browsing.</ShopAccountBodyText>
        <ShopAccountLinkButton href="/login?returnTo=%2Faccount" label="Try again" />
        <ShopAccountLinkButton href="/" label="Return home" variant="outline" />
      </ShopAccountShell>
    );
  }

  redirect("/account");
}
