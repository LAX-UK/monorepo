/** The estimate on a lot card, in one muted style everywhere ("Estimate £4,000 – £6,000"). */
export function LotEstimateLine({ value }: { value: string | null }) {
  return value ? (
    <p className="m-0 font-body text-sm leading-5 text-on-surface-variant">
      Estimate <span className="whitespace-nowrap">{value}</span>
    </p>
  ) : null;
}
