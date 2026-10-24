import { ShopPolicyRoute, shopPolicyMetadata } from "@/components/policies/shop-policy-route";

/** Draft visibility depends on the deployment, so the page is rendered per request. */
export const dynamic = "force-dynamic";

export const generateMetadata = () => shopPolicyMetadata("help");

export default function HelpPage() {
  return <ShopPolicyRoute slug="help" />;
}
