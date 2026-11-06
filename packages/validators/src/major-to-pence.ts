import { majorGbpToPence } from "@auction/domain";

/** A money string in pounds ("1250.5", "1250.50") as whole pence, through the shared rule. */
export function majorToPence(major: string): number {
  const n = Number.parseFloat(major);
  return Number.isFinite(n) ? majorGbpToPence(n) : 0;
}
