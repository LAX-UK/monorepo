type EmptyObject = Record<string, never>;

/**
 * For `exactOptionalPropertyTypes`: include `key` only when `value` is defined.
 */
export function optionalString<K extends string>(
  key: K,
  value: string | undefined,
): EmptyObject | { [P in K]: string } {
  if (value === undefined) {
    return {} as EmptyObject;
  }
  return { [key]: value } as { [P in K]: string };
}
