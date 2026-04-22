import { formatMoney } from "@/lib/format-currency";
import { Separator } from "@auction/ui";

type Props = {
  estimateLine: string | null;
  currentPrice: string;
  bidCount: number;
  closingLabel: string;
};

/**
 * Figma: three bordered rows — Estimate, Current bid (N bids), Closing.
 */
export function LotInfoStack({ estimateLine, currentPrice, bidCount, closingLabel }: Props) {
  return (
    <div className="w-full max-w-[550px]">
      <InfoRow label="Estimate" value={estimateLine ?? "—"} valueClass="text-xl font-medium" />
      <Separator className="bg-[#D1D1D1] dark:bg-outline-variant" />
      <InfoRow
        label={`Current bid (${bidCount} ${bidCount === 1 ? "bid" : "bids"})`}
        value={formatMoney(currentPrice)}
        valueClass="text-xl font-medium"
      />
      <Separator className="bg-[#D1D1D1] dark:bg-outline-variant" />
      <InfoRow label="Closing" value={closingLabel} valueClass="text-xl font-medium" />
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col justify-center gap-2.5 py-4">
      <span className="text-base leading-4 text-[#191919] dark:text-brand-500">{label}</span>
      <span
        className={`text-[#191919] tabular-nums leading-4 dark:text-brand-500 ${valueClass ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}
