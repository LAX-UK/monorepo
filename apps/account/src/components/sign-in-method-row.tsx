import type { SocialSignInProvider } from "@auction/identity-contracts/account";
import type { ReactNode } from "react";
import { TAG } from "./account-ui";
import { ProviderMark } from "./provider-mark";

/** A row of the list: the text, then its button beside it, or under it on a phone. */
export const SIGN_IN_METHOD_ROW =
  "flex min-h-16 flex-col items-start gap-y-2 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1 sm:px-6";

/** A passkey's row sits a step in under the "Passkeys" row it belongs to. */
export const SIGN_IN_METHOD_SUBROW = `${SIGN_IN_METHOD_ROW} sm:pl-12`;

type RowTextProps = {
  title: string;
  /** Said in words beside the title ("Set"), so the state never depends on colour. */
  status?: string | undefined;
  detail: ReactNode;
  /** Said after the detail from the small-tablet width up. */
  detailMore?: string | undefined;
  /** Said from the small-tablet width up in place of the detail. */
  detailLong?: string | undefined;
  provider?: SocialSignInProvider | undefined;
};

/** The title and the line under it that every row of "How you sign in" starts with. */
export function SignInMethodRowText({
  title,
  status,
  detail,
  detailMore,
  detailLong,
  provider,
}: RowTextProps) {
  return (
    <div className="min-w-0 sm:flex-1 sm:basis-48">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-surface">
        {provider ? <ProviderMark provider={provider} /> : null}
        {title}
        {status ? <span className={TAG}>{status}</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        {detailLong ? (
          <>
            <span className="sm:hidden">{detail}</span>
            <span className="hidden sm:inline">{detailLong}</span>
          </>
        ) : (
          detail
        )}
        {detailMore ? <span className="hidden sm:inline"> {detailMore}</span> : null}
      </p>
    </div>
  );
}
