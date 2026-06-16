import Link from "next/link";

type Props = {
  saleHref: string;
  isAuthenticated: boolean;
};

/** Short hybrid-sale guidance above the catalogue. */
export function SaleroomHowToBidStrip({ saleHref, isAuthenticated }: Props) {
  const loginHref = `/login?next=${encodeURIComponent(saleHref)}`;

  return (
    <div
      className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-4 py-3 dark:bg-surface-container-low/30"
      aria-label="How to bid on this sale"
    >
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        How to bid
      </p>
      <ul className="mt-2 space-y-1.5 font-body text-sm text-on-surface">
        <li>
          <strong className="font-medium">Online (private collectors):</strong>{" "}
          {isAuthenticated ? (
            "Complete KYC, then bid on lots in this catalogue."
          ) : (
            <>
              <Link href={loginHref} className="text-link underline-offset-4 hover:underline">
                Sign in
              </Link>
              , complete KYC, then bid on lots in this catalogue.
            </>
          )}
        </li>
        <li>
          <strong className="font-medium">Buyer agents:</strong> use{" "}
          <Link
            href={`${saleHref}#participate`}
            className="text-link underline-offset-4 hover:underline"
          >
            Register to bid
          </Link>{" "}
          for your organisation before placing bids.
        </li>
        <li>
          <strong className="font-medium">In the saleroom:</strong> check in at the desk for a
          paddle — no online registration required for floor bidding.
        </li>
      </ul>
    </div>
  );
}
