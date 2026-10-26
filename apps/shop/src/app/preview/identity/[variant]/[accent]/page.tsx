import "@/components/preview/shop-identity-preview.css";
import {
  PairingPreview,
  assertIdentityPreviewAvailable,
  findPreviewPairing,
} from "@/components/preview/shop-identity-preview";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { notFound } from "next/navigation";

export const metadata = shopPrivatePageTitle("Identity preview");

type PairingPageProps = { params: Promise<{ variant: string; accent: string }> };

export default async function IdentityPairingPage({ params }: PairingPageProps) {
  assertIdentityPreviewAvailable();
  const { variant, accent } = await params;
  const pairing = findPreviewPairing(variant, accent);
  if (!pairing) notFound();
  return <PairingPreview variant={pairing.variant} accent={pairing.accent} />;
}
