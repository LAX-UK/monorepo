/**
 * The stable stand-in for a person whose account Identity has purged. Financial and legal records
 * keep a name so staff can still tell two erased people apart; this is that name. It is derived
 * from the opaque subject id, so every product and every retry produces the same label, and it
 * carries nothing about the person.
 */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a32(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** "Deleted user 7F3A": four uppercase hex characters, stable per subject. */
export function deletedUserPseudonym(subjectId: string): string {
  const tag = (fnv1a32(subjectId) & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return `Deleted user ${tag}`;
}
