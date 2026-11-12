/** Code-unit ordering. Never `localeCompare`: the result must not depend on the runtime locale. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
