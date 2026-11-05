/** Longest first name shown beside the avatar before it is cut. */
export const ACCOUNT_ENTRY_NAME_MAX = 12;

/** Cuts a name to `max` characters, ending in an ellipsis when it was cut. */
export function cutAccountEntryName(name: string, max: number = ACCOUNT_ENTRY_NAME_MAX): string {
  const chars = Array.from(name);
  return chars.length <= max ? name : `${chars.slice(0, max).join("")}…`;
}
