import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";

/**
 * Security's one quiet pointer to deleting the account, which Privacy holds. It is a link, not
 * a section, so the page does not offer the same step twice.
 */
export function DeleteAccountLink() {
  return (
    <p>
      <a
        href={ACCOUNT_ROUTES.deleteAccountOnPrivacy}
        className="inline-flex min-h-11 items-center rounded-sm text-sm text-on-surface-variant underline underline-offset-4 hover:text-on-surface"
      >
        Delete your account
      </a>
    </p>
  );
}
