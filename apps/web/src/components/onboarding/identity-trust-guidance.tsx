import Link from "next/link";

export function IdentityTrustGuidance() {
  return (
    <section
      aria-labelledby="identity-trust-heading"
      className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-5 py-5 text-left text-sm text-on-surface-variant sm:px-6"
    >
      <h2 id="identity-trust-heading" className="text-base font-medium text-on-surface">
        Why we verify and how your data is handled
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          Identity verification helps keep bidding secure, prevents fraud, and protects every
          participant in the room.
        </li>
        <li>
          Verification is processed by Veriff, our regulated identity partner. You will need a valid
          photo ID and a quick selfie in good lighting.
        </li>
        <li>
          Most checks finish in a few minutes. If review is needed, we will update your account
          status as soon as it is complete.
        </li>
        <li>
          We only collect what is required for compliance. Documents are handled securely and are
          not stored on this device.
        </li>
        <li>
          You can request help or manual review through{" "}
          <Link href="/contact" className="font-medium text-link underline underline-offset-2">
            support
          </Link>{" "}
          if verification fails or you need an alternative.
        </li>
      </ul>
    </section>
  );
}
