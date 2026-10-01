/** UK postcode format (outward + inward); case and spacing tolerant. */
export function isValidUkPostcode(value: string): boolean {
  const compact = value.trim().replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact);
}
