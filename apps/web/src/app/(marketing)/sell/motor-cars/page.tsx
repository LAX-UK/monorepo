import {
  SellTailoredLandingPage,
  sellTailoredPageMetadata,
} from "@/components/marketing/sell-tailored-landing-page";

export const metadata = sellTailoredPageMetadata({
  path: "/sell/motor-cars",
  title: "Motor cars",
  description:
    "Consign classic and collectible motor cars with VIN details, ownership history, and mechanical condition photographs for specialist review.",
});

export default function SellMotorCarsPage() {
  return (
    <SellTailoredLandingPage
      path="/sell/motor-cars"
      breadcrumbLabel="Motor cars"
      title="Motor cars"
      description="Our motor car desk reviews provenance, mechanical condition, and logistics before scheduling for sale."
      eyebrow="Motor cars"
      lead="Selling a classic or collectible motor car? Share VIN details, mileage, ownership history, and photographs of the exterior, interior, and mechanical condition."
      categorySlug="motor-cars"
      bullets={[
        "Exterior from several angles, interior, and odometer reading",
        "VIN plate, engine bay, and any known ownership history",
        "Mechanical condition and recent service records in submitter notes",
        "Logistics and location details for collection or inspection",
        "Single vehicles can be submitted through the standard wizard in about 3 minutes",
      ]}
    />
  );
}
