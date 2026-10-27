import type { AccountChrome } from "@/lib/navigation/account-switcher-model";

type Props = {
  strip: NonNullable<AccountChrome["strip"]>;
};

/**
 * The thin "Northbank Gallery · Admin" strip under the page header while Bid is used as an
 * organisation. With the switcher it names the account in two places, so nobody bids or sells
 * from the wrong one by accident.
 */
export function AccountStrip({ strip }: Props) {
  return (
    <section
      aria-label="Account in use"
      className="shrink-0 border-b border-secondary/15 bg-secondary-container"
      data-testid="account-strip"
    >
      <p className="mx-auto flex max-w-[var(--container-inner,1376px)] items-center gap-1.5 px-4 py-1.5 font-body text-[13px] leading-5 text-secondary md:px-8">
        <span className="sr-only">Using Bid as</span>
        <span className="min-w-0 truncate font-medium">{strip.name}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{strip.role}</span>
      </p>
    </section>
  );
}
