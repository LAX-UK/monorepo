export type ArtworkDimensionsCm = {
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
};

function formatCm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

/** Builds a human-readable cm line (H × W × D) for catalogue surfaces. */
export function formatArtworkDimensionsCm(input: ArtworkDimensionsCm): string | null {
  const height = input.heightCm;
  const width = input.widthCm;
  const depth = input.depthCm;
  if (height == null && width == null && depth == null) {
    return null;
  }
  const parts: string[] = [];
  if (height != null) parts.push(`${formatCm(height)} cm H`);
  if (width != null) parts.push(`${formatCm(width)} cm W`);
  if (depth != null) parts.push(`${formatCm(depth)} cm D`);
  return parts.join(" × ");
}

export type ArtworkSize = { cm: string; inches: string };

const CM_PER_INCH = 2.54;

function oneDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * Height × width (× depth) in centimetres and inches, e.g. "50 × 40 cm" and "19.7 × 15.7 in".
 * Null unless both height and width are known and positive.
 */
export function formatArtworkSize(input: ArtworkDimensionsCm): ArtworkSize | null {
  const { heightCm, widthCm, depthCm } = input;
  if (heightCm == null || widthCm == null || heightCm <= 0 || widthCm <= 0) return null;
  const parts = [heightCm, widthCm, ...(depthCm != null && depthCm > 0 ? [depthCm] : [])];
  return {
    cm: `${parts.map(oneDecimal).join(" × ")} cm`,
    inches: `${parts.map((cm) => oneDecimal(cm / CM_PER_INCH)).join(" × ")} in`,
  };
}
