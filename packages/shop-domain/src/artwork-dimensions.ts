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
