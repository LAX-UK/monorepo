/**
 * Rule: a link that goes through the client router must not point at an account hop.
 *
 * `/switch-account` and `/restore-account` answer with a cookie and a redirect. The client
 * router follows that redirect with the layout it already holds, so the page re-renders in the
 * old account's frame (or loops). Inside Bid, an account changes through `useAccountSwitch`
 * (a server action and a page load); a hop is only ever opened as a page, so a plain `<a>` is
 * fine. This flags `<Link>` and `<ButtonLink>` whose attributes name a hop.
 */

const ROUTER_LINKS = ["Link", "ButtonLink"];

const HOP_REFERENCES = [
  /\bswitchAccountHref\b/,
  /\brestoreAccountHref\b/,
  /\bconfirmSwitchHref\b/,
  /\bCLIENT_ROUTES\.account(?:Switch|Restore)\b/,
  /["'`]\/(?:switch|restore)-account\b/,
];

/** The text of a JSX opening tag starting at `start` (just after the tag name), or null. */
function readOpeningTagAttributes(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === "{") depth++;
    else if (char === "}") depth--;
    else if (char === ">" && depth === 0 && text[i - 1] !== "=") return text.slice(start, i);
  }
  return null;
}

/** 1-based line numbers of router links that point at an account hop. */
export function findHopLinks(text) {
  const found = [];
  const opening = new RegExp(`<(?:${ROUTER_LINKS.join("|")})(?=[\\s/>])`, "g");
  for (const match of text.matchAll(opening)) {
    const attributes = readOpeningTagAttributes(text, match.index + match[0].length);
    if (attributes === null) continue;
    if (HOP_REFERENCES.some((re) => re.test(attributes))) {
      found.push(text.slice(0, match.index).split("\n").length);
    }
  }
  return found;
}
