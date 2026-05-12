import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.server";

function headlineForFulfilment(f: LotFulfilmentSnapshot | null): {
  label: string;
  detail: string | null;
} {
  if (!f) {
    return {
      label: "Payment & fulfilment",
      detail:
        "When you pay, we will show collection or shipping progress here. Refresh after checkout if this does not update.",
    };
  }
  switch (f.status) {
    case "awaiting_payment":
      return {
        label: "Awaiting payment",
        detail: "Complete checkout below when your invoice is ready.",
      };
    case "awaiting_release":
      return {
        label: "Paid — awaiting release",
        detail: "Operations will release the lot after payment is confirmed.",
      };
    case "released":
      return {
        label: "Released",
        detail:
          f.fulfilmentMethod === "shipping"
            ? "Shipping will be arranged next."
            : f.fulfilmentMethod === "collection"
              ? "You will be notified when the lot is ready to collect."
              : "Logistics will be confirmed shortly.",
      };
    case "ready_for_collection":
      return {
        label: "Ready for collection",
        detail: "Arrange pickup with the team when advised.",
      };
    case "in_transit": {
      const bits = [f.shippingCarrier, f.trackingNumber].filter(Boolean).join(" · ");
      return {
        label: "In transit",
        detail: bits || "Your shipment is on the way.",
      };
    }
    case "delivered":
      return {
        label: "Delivered",
        detail:
          f.fulfilmentMethod === "collection" && (f.collectedBy || f.collectedAt)
            ? [
                f.collectedBy ? `Collected by ${f.collectedBy}` : null,
                f.collectedAt ? new Date(f.collectedAt).toLocaleString() : null,
              ]
                .filter(Boolean)
                .join(" · ") || null
            : "Thank you — this lot is complete.",
      };
    case "cancelled":
      return { label: "Fulfilment cancelled", detail: "Contact support if this is unexpected." };
    default:
      return { label: f.status.replaceAll("_", " "), detail: null };
  }
}

type Props = {
  fulfilment: LotFulfilmentSnapshot | null;
};

export function LotCheckoutFulfilmentStrip({ fulfilment }: Props) {
  const { label, detail } = headlineForFulfilment(fulfilment);
  return (
    <div className="mb-8 flex flex-col gap-1 lg:mb-10">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
        <span className="font-label text-xs font-bold uppercase tracking-[0.3em] text-primary">
          {label}
        </span>
      </div>
      {detail ? (
        <p className="pl-4 font-body text-xs leading-relaxed text-on-surface-variant">{detail}</p>
      ) : null}
    </div>
  );
}
