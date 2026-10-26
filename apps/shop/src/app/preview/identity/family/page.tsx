import "@/components/preview/shop-identity-preview.css";
import {
  FamilyComparison,
  assertIdentityPreviewAvailable,
} from "@/components/preview/shop-identity-preview";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";

export const metadata = shopPrivatePageTitle("Identity preview: family");

export default function IdentityFamilyPage() {
  assertIdentityPreviewAvailable();
  return <FamilyComparison />;
}
