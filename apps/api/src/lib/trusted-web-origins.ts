export function buildTrustedWebOrigins(input: {
  webOrigin: string;
  webOrigins?: string[] | undefined;
  additionalOrigins?: string[] | undefined;
}): string[] {
  const origins = [
    input.webOrigin,
    ...(input.webOrigins ?? []),
    ...(input.additionalOrigins ?? []),
  ];
  return [
    ...new Set(origins.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin))),
  ];
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
