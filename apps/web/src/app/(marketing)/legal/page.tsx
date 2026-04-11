import { LegalPage } from "@/components/marketing/legal-page";
import Link from "next/link";

export default function LegalHubPage() {
  return (
    <LegalPage title="Legal">
      <p>Key policies for collectors using The Digital Curator.</p>
      <ul className="list-inside list-disc space-y-3 text-on-surface">
        <li>
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of sale
          </Link>
        </li>
        <li>
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy
          </Link>
        </li>
        <li>
          <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
            Shipping
          </Link>
        </li>
      </ul>
    </LegalPage>
  );
}
