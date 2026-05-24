/** Sum decimal strings (major currency units) to 2dp. */
export function sumDecimal(values: string[]): string {
  let total = 0;
  for (const v of values) total += Number.parseFloat(v);
  return total.toFixed(2);
}

export function subtractDecimal(a: string, b: string): string {
  return (Number.parseFloat(a) - Number.parseFloat(b)).toFixed(2);
}

export function addDecimal(a: string, b: string): string {
  return (Number.parseFloat(a) + Number.parseFloat(b)).toFixed(2);
}

/** Convert GBP major units string to integer pence. */
export function gbpAmountToPence(amount: string): number {
  return Math.round(Number.parseFloat(amount) * 100);
}
