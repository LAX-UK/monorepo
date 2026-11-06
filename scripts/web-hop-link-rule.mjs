/**
 * Rule: nothing that goes through the client router may reach an account hop.
 *
 * `/switch-account` and `/restore-account` answer with a cookie and a redirect. The client
 * router follows that redirect with the layout it already holds, so the page re-renders in the
 * old account's frame (or loops). Inside Bid, an account changes through `useAccountSwitch`
 * (a server action and a page load); a hop is only ever opened as a page, so a plain `<a>` or
 * `window.location.assign` is fine. This flags:
 *
 * - `<Link>`, `<ButtonLink>` and `<RecordRow linkAs={Link}>` whose attributes name a hop, use
 *   `withAccount(` (an `?account=` link, which the middleware turns into a hop), or unwrap a
 *   `HopHref` (`hopUrl(`, `hopHref(`);
 * - `router.push` / `router.replace` with the same;
 * - `redirect(` / `permanentRedirect(` with a hop (a server redirect is followed by the client
 *   router too).
 *
 * View models return hop hrefs as a `HopHref`, which `<Link href>` rejects at typecheck; this
 * rule covers the places a string can still get through. It reads one expression at a time, so an
 * href built in a variable first is not seen. `AccountSwitchLink` is the one router-side link
 * that may carry a hop: it switches through the server action and loads the page afresh.
 */

const ROUTER_LINKS = ["Link", "ButtonLink", "RecordRow"];

/** A `RecordRow` only uses the client router when it is given the framework link. */
const FRAMEWORK_LINK = /\blinkAs=\{Link\}/;
/** The link that switches through the server action first, so it may carry a hop. */
const SWITCHING_LINK = /\b(?:linkAs|Link)=\{AccountSwitchLink\}/;

/** An `?account=` link: the middleware sends it to the switch hop. */
const ACCOUNT_LINKS = [
  /\bwithAccount\(/,
  // Unwrapping a `HopHref` into a router link defeats its type.
  /\bhop(?:Url|Href)\(/,
  // `organisationHref(tab, accountId)` and `teamHref(tab, accountId)` name an account.
  /\b(?:organisationHref|teamHref)\([^()]*,/,
];

const HOP_REFERENCES = [
  /\bswitchAccountHref\b/,
  /\brestoreAccountHref\b/,
  /\bconfirmSwitchHref\b/,
  /\bCLIENT_ROUTES\.account(?:Switch|Restore)\b/,
  /["'`]\/(?:switch|restore)-account\b/,
];

/** Only the two routes that write the cookie; their confirm and retry pages are ordinary pages. */
const REDIRECT_HOPS = [
  /\bswitchAccountHref\b/,
  /\brestoreAccountHref\b/,
  /\bCLIENT_ROUTES\.account(?:Switch|Restore)\b(?!\w)/,
  /["'`]\/(?:switch|restore)-account(?:[?"'`]|$)/,
  ...ACCOUNT_LINKS,
];

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

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

/** The text of a call's arguments, from just after its `(`, or null if it never closes. */
function readCallArguments(text, start) {
  let depth = 1;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(") depth++;
    else if (char === ")" && --depth === 0) return text.slice(start, i);
  }
  return null;
}

function callsWith(text, opening, references) {
  const found = [];
  for (const match of text.matchAll(opening)) {
    const args = readCallArguments(text, match.index + match[0].length);
    if (args !== null && references.some((re) => re.test(args))) {
      found.push(lineOf(text, match.index));
    }
  }
  return found;
}

/** 1-based line numbers of router links that point at an account hop or an `?account=` link. */
export function findHopLinks(text) {
  const found = [];
  const references = [...HOP_REFERENCES, ...ACCOUNT_LINKS];
  const opening = new RegExp(`<(?:${ROUTER_LINKS.join("|")})(?=[\\s/>])`, "g");
  for (const match of text.matchAll(opening)) {
    const attributes = readOpeningTagAttributes(text, match.index + match[0].length);
    if (attributes === null) continue;
    if (match[0] === "<RecordRow" && !FRAMEWORK_LINK.test(attributes)) continue;
    if (SWITCHING_LINK.test(attributes)) continue;
    if (references.some((re) => re.test(attributes))) found.push(lineOf(text, match.index));
  }
  return found;
}

/** 1-based line numbers of `router.push` / `router.replace` calls that reach an account hop. */
export function findHopRouterCalls(text) {
  return callsWith(text, /\b\w*[rR]outer\.(?:push|replace)\(/g, [
    ...HOP_REFERENCES,
    ...ACCOUNT_LINKS,
  ]);
}

/** 1-based line numbers of `redirect(` calls that send the client router to an account hop. */
export function findHopRedirects(text) {
  return callsWith(text, /(?<![.\w])(?:permanentRedirect|redirect)\(/g, REDIRECT_HOPS);
}

/** Every violation in a file: `{ line, what }`, in line order. */
export function findHopViolations(text) {
  return [
    ...findHopLinks(text).map((line) => ({ line, what: "a router link to an account hop" })),
    ...findHopRouterCalls(text).map((line) => ({
      line,
      what: "router.push or router.replace to an account hop",
    })),
    ...findHopRedirects(text).map((line) => ({
      line,
      what: "redirect() or permanentRedirect() to an account hop",
    })),
  ].sort((a, b) => a.line - b.line);
}
