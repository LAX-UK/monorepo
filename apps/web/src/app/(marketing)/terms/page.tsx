import { LegalPage } from "@/components/marketing/legal-page";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of sale">
      <p>
        By registering to bid, you agree to honor all winning bids as binding purchase commitments,
        subject to reserve and auction rules published for each lot. Buyer&apos;s premium, taxes,
        and shipping are additional unless stated otherwise on the invoice.
      </p>
      <p>
        We may refuse service or cancel bids that appear fraudulent, collusive, or in violation of
        applicable law. Nothing on this site constitutes investment or legal advice.
      </p>
      <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
        Last updated {new Date().getFullYear()}
      </p>
    </LegalPage>
  );
}
