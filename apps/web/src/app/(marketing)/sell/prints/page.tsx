import {
  SellTailoredLandingPage,
  sellTailoredPageMetadata,
} from "@/components/marketing/sell-tailored-landing-page";

export const metadata = sellTailoredPageMetadata({
  path: "/sell/prints",
  title: "Prints & editions",
  description:
    "Consign limited editions, portfolios, and multiples with edition details and condition notes for specialist review.",
});

export default function SellPrintsPage() {
  return (
    <SellTailoredLandingPage
      path="/sell/prints"
      breadcrumbLabel="Prints & editions"
      title="Prints & editions"
      description="Our prints desk reviews edition numbers, publisher details, and condition notes before catalogue preparation."
      eyebrow="Prints & editions"
      lead="Selling limited editions, portfolios, or multiples? Share edition details, publisher information, and clear photographs for specialist review."
      contactType="prints"
      bullets={[
        "Edition number and total edition size (e.g. 12/75)",
        "Publisher, printer, and year of publication where known",
        "Overall, signature, and condition detail photographs",
        "Provenance or acquisition history when available",
        "Single prints can also be submitted through the standard wizard",
      ]}
    />
  );
}
