import { AccountShell } from "@/components/account-shell";
import { EmailChangeConfirm } from "@/components/email-change-confirm.client";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** The link carries a signed token: keep it out of search results and Referer headers. */
export const metadata: Metadata = {
  title: "Confirm your email change · LAX Account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type EmailChangePageProps = { searchParams: Promise<{ t?: string | string[] }> };

/** Where the links in the email-change emails land. No sign-in is needed: the token is the proof. */
export default async function EmailChangePage({ searchParams }: EmailChangePageProps) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";
  return (
    <AccountShell>
      <div className="mx-auto w-full max-w-md py-6">
        <EmailChangeConfirm
          token={token}
          signInHref={`/api/auth/login?returnTo=${ACCOUNT_ROUTES.profile}`}
        />
      </div>
    </AccountShell>
  );
}
