import { LegalPage } from "@/components/marketing/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        We collect account and session data necessary to operate auctions, process settlements, and
        comply with legal obligations. Payment details are handled by our payment partners; we do
        not store full card numbers on our servers.
      </p>
      <p>
        You may request access or deletion of personal data where applicable law allows. Marketing
        communications are opt-in and can be withdrawn at any time.
      </p>
    </LegalPage>
  );
}
