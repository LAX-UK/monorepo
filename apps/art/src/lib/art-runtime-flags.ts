export function isArtEditorialEnabled(): boolean {
  return process.env.ART_EDITORIAL_ENABLED === "true";
}
