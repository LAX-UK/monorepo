import "@/components/preview/shop-identity-preview.css";
import {
  PairingGrid,
  assertIdentityPreviewAvailable,
} from "@/components/preview/shop-identity-preview";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";

export const metadata = shopPrivatePageTitle("Identity preview");

export default function IdentityPreviewPage() {
  assertIdentityPreviewAvailable();
  return <PairingGrid />;
}
