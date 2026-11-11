/**
 * The rule for a passkey's name, as the page checks it before asking the issuer. The issuer's own
 * rule is `isValidPasskeyName` in `@auction/identity-contracts`; the hosted pages carry this small
 * copy so their script does not bundle the contracts package, and `passkey-name.test.ts` fails if
 * the two ever disagree.
 */
export const PASSKEY_NAME_LIMIT = 40;

export function isAcceptablePasskeyName(value: string): boolean {
  const name = value.trim();
  return (
    name.length >= 1 &&
    name.length <= PASSKEY_NAME_LIMIT &&
    !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name)
  );
}
