export function isPgUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && (current as { code: string }).code === "23505") {
      return true;
    }
    current = "cause" in current ? (current as { cause: unknown }).cause : null;
  }
  return false;
}

export function pgUniqueViolationConstraint(error: unknown): string | null {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    if ("code" in current && (current as { code: string }).code === "23505") {
      const constraint = (current as { constraint?: string }).constraint;
      return typeof constraint === "string" ? constraint : null;
    }
    current = "cause" in current ? (current as { cause: unknown }).cause : null;
  }
  return null;
}
