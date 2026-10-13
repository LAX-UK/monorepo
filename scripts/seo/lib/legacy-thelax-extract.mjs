import { parse } from "node-html-parser";
import { LEGACY_THELAX_ORIGIN } from "./legacy-thelax-urls.mjs";

/**
 * Extractors for the legacy www.thelax.art templates. Output blocks follow the
 * `@auction/shop-contracts` editorial block shape, but image `mediaKey` and link `href`
 * stay as absolute legacy URLs: the importer rewrites them once media and slugs are known.
 */

const CHROME_SELECTORS = "script,style,noscript,header,footer,nav,.modal,form";
const SOLD_TITLE_PREFIX = /^\*?\s*sold\s*\*?\s*/i;

export function parseLegacyHtml(html) {
  return parse(html, { comment: false, blockTextElements: { script: true, style: true } });
}

function clean(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function absolute(href) {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) return null;
  try {
    return new URL(trimmed, LEGACY_THELAX_ORIGIN).toString();
  } catch {
    return null;
  }
}

function metaContent(root, selector) {
  const value = clean(root.querySelector(selector)?.getAttribute("content"));
  return value.length > 0 ? value : null;
}

/** SEO surface of any legacy page, read before chrome is stripped. */
export function extractSeo(root) {
  return {
    title: clean(root.querySelector("title")?.text) || null,
    description: metaContent(root, 'meta[name="description"]'),
    canonical: clean(root.querySelector('link[rel="canonical"]')?.getAttribute("href")) || null,
    robots: metaContent(root, 'meta[name="robots"]'),
    ogImage: metaContent(root, 'meta[property="og:image"]'),
    h1: clean(root.querySelector("h1")?.text) || null,
  };
}

function stripChrome(root) {
  for (const node of root.querySelectorAll(CHROME_SELECTORS)) node.remove();
  return root;
}

function isBold(el) {
  const tag = el.rawTagName?.toLowerCase();
  if (tag === "b" || tag === "strong") return true;
  return /font-weight:\s*(bold|[6-9]00)/i.test(el.getAttribute?.("style") ?? "");
}

function isItalic(el) {
  const tag = el.rawTagName?.toLowerCase();
  return tag === "i" || tag === "em";
}

/** Inline spans for one paragraph-level element; adjacent same-mark spans are merged. */
export function inlineSpans(el, inherited = { marks: [], href: null }) {
  const spans = [];
  for (const child of el.childNodes) {
    if (child.nodeType === 3) {
      const text = child.text.replace(/\s+/g, " ");
      if (text.length === 0) continue;
      const span = { text };
      if (inherited.marks.length > 0) span.marks = [...inherited.marks];
      if (inherited.href) span.href = inherited.href;
      spans.push(span);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = child.rawTagName?.toLowerCase();
    if (tag === "br") {
      spans.push({ text: " " });
      continue;
    }
    if (tag === "img") continue;
    const marks = new Set(inherited.marks);
    let href = inherited.href;
    if (isBold(child)) marks.add("bold");
    if (isItalic(child)) marks.add("italic");
    if (tag === "a") {
      const target = absolute(child.getAttribute("href"));
      if (target) {
        marks.add("link");
        href = target;
      }
    }
    spans.push(...inlineSpans(child, { marks: [...marks].sort(), href }));
  }
  return mergeSpans(spans);
}

function sameSpanShape(a, b) {
  return (a.marks ?? []).join() === (b.marks ?? []).join() && (a.href ?? null) === (b.href ?? null);
}

function mergeSpans(spans) {
  const merged = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && sameSpanShape(last, span)) last.text += span.text;
    else merged.push({ ...span });
  }
  if (merged.length > 0) {
    merged[0].text = merged[0].text.trimStart();
    merged.at(-1).text = merged.at(-1).text.trimEnd();
  }
  return merged.filter((span) => span.text.length > 0);
}

function headingLevel(tag) {
  const level = Number(tag.slice(1));
  return Math.min(4, Math.max(2, level));
}

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "tbody",
  "thead",
  "tr",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

function hasBlockChildren(el) {
  return el.childNodes.some(
    (child) => child.nodeType === 1 && BLOCK_TAGS.has(child.rawTagName?.toLowerCase()),
  );
}

function imageBlock(img) {
  const url = absolute(img.getAttribute("data-zoom") ?? img.getAttribute("src"));
  if (!url) return null;
  const alt = clean(img.getAttribute("alt"));
  return { type: "image", mediaKey: url, ...(alt ? { alt: alt.slice(0, 500) } : {}) };
}

function videoBlock(iframe) {
  const src = absolute(iframe.getAttribute("src"));
  if (!src?.startsWith("https://")) return null;
  const title = clean(iframe.getAttribute("title"));
  return { type: "video", url: src, ...(title ? { title: title.slice(0, 200) } : {}) };
}

/** Converts rich HTML (CMS WYSIWYG output) into editorial blocks. */
export function htmlToBlocks(container) {
  const blocks = [];
  const pushText = (el, prefix = "") => {
    const spans = inlineSpans(el);
    if (spans.length === 0) return;
    if (prefix) spans[0] = { ...spans[0], text: `${prefix}${spans[0].text}` };
    blocks.push({ type: "richText", spans });
  };
  const walk = (el) => {
    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        const text = clean(child.text);
        if (text) blocks.push({ type: "richText", spans: [{ text }] });
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.rawTagName?.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const text = clean(child.text);
        if (text)
          blocks.push({ type: "heading", level: headingLevel(tag), text: text.slice(0, 500) });
        continue;
      }
      if (tag === "img") {
        const image = imageBlock(child);
        if (image) blocks.push(image);
        continue;
      }
      if (tag === "iframe") {
        const video = videoBlock(child);
        if (video) blocks.push(video);
        continue;
      }
      if (tag === "blockquote") {
        const text = clean(child.text);
        if (text) blocks.push({ type: "quote", text: text.slice(0, 2000) });
        continue;
      }
      if (tag === "ul" || tag === "ol") {
        child.querySelectorAll("li").forEach((li, index) => {
          pushText(li, tag === "ol" ? `${index + 1}. ` : "• ");
        });
        continue;
      }
      if (tag === "tr") {
        const cells = child.querySelectorAll("td,th").map((cell) => clean(cell.text));
        const text = cells.filter(Boolean).join(" — ");
        if (text) blocks.push({ type: "richText", spans: [{ text }] });
        continue;
      }
      for (const img of child.querySelectorAll("img")) {
        if (!hasBlockChildren(child)) {
          const image = imageBlock(img);
          if (image) blocks.push(image);
        }
      }
      if (hasBlockChildren(child)) walk(child);
      else pushText(child);
    }
  };
  walk(container);
  return blocks;
}

export function blocksToPlainText(blocks) {
  return blocks
    .map((block) => {
      if (block.type === "richText") return block.spans.map((span) => span.text).join("");
      if (block.type === "heading" || block.type === "quote") return block.text;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

const DIMENSION_PATTERN =
  /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*(cm|mm|in)?/i;

/** "60 x 70 cm" → height/width(/depth) in centimetres, as the old site lists height first. */
export function parseDimensions(text) {
  const match = DIMENSION_PATTERN.exec(text ?? "");
  if (!match) return null;
  const unit = (match[4] ?? "cm").toLowerCase();
  const factor = unit === "mm" ? 0.1 : unit === "in" ? 2.54 : 1;
  const toCm = (value) =>
    value === undefined ? null : Math.round(Number(value) * factor * 100) / 100;
  return { heightCm: toCm(match[1]), widthCm: toCm(match[2]), depthCm: toCm(match[3]) };
}

function labelledFields(root) {
  const fields = new Map();
  for (const label of root.querySelectorAll("span.f-w-7, span.f-w-6")) {
    const key = clean(label.text).replace(/:$/, "").toLowerCase();
    if (!key || fields.has(key)) continue;
    const parent = label.parentNode;
    const links = parent
      .querySelectorAll("a")
      .map((a) => ({ name: clean(a.text), url: absolute(a.getAttribute("href")) }))
      .filter((link) => link.name && link.url);
    const value = clean(parent.text.replace(label.text, ""));
    fields.set(key, { value, links });
  }
  return fields;
}

function legacyPath(url) {
  return url ? new URL(url).pathname : null;
}

function sectionAfterHeading(root, headingText) {
  const heading = root
    .querySelectorAll("h4")
    .find((h) => clean(h.text).toLowerCase() === headingText.toLowerCase());
  return heading?.parentNode.querySelector(".main-html--data") ?? null;
}

/** `/collection|print|sculpture/<slug>.html` detail page. */
export function extractArtwork(html) {
  const root = stripChrome(parseLegacyHtml(html));
  const h1 = root.querySelector("h1");
  const details = h1?.parentNode ?? root;
  const rawTitle = clean(h1?.text);
  const fields = labelledFields(root);
  const artistHeading = details.querySelector(".h-featured_artist");
  const descriptionEl = sectionAfterHeading(root, "Description");
  const descriptionBlocks = descriptionEl ? htmlToBlocks(descriptionEl) : [];
  const soldBadge = details
    .querySelectorAll("a.btn-danger")
    .some((a) => clean(a.text).toUpperCase() === "SOLD");
  const original = details
    .querySelectorAll("a")
    .map((a) => absolute(a.getAttribute("href")))
    .find((url) => url && /\/collection\/[^/]+\.html$/.test(url));
  const artistLink = root
    .querySelectorAll("a.h-featured_artist, .h-featured_artist a")
    .map((a) => absolute(a.getAttribute("href")))
    .find((url) => url && /\/collections\/[^/]+\.html$/.test(url));
  const images = [];
  const seen = new Set();
  for (const slide of root.querySelectorAll(".slide")) {
    const link = slide.querySelector("a[data-lightbox]");
    const img = slide.querySelector("img");
    const url = absolute(link?.getAttribute("href") ?? img?.getAttribute("data-zoom"));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push({ url, alt: clean(img?.getAttribute("alt")) || null });
  }
  const dimensionsText = fields.get("dimensions")?.value || null;
  const yearMatch = /\b(1[5-9]\d\d|20\d\d)\b/.exec(fields.get("date")?.value ?? "");
  const linksFor = (key) =>
    (fields.get(key)?.links ?? []).map((link) => ({
      name: link.name,
      legacyPath: legacyPath(link.url),
    }));
  return {
    title: rawTitle.replace(SOLD_TITLE_PREFIX, "").trim(),
    artistName: clean(artistHeading?.text) || null,
    artistLegacyPath: legacyPath(artistLink),
    originalLegacyPath: legacyPath(original),
    sold: soldBadge || SOLD_TITLE_PREFIX.test(rawTitle),
    unique: /\bunique work\b/i.test(details.text),
    certificate: details.querySelector('[data-bs-target="#coaModal"]') !== null,
    year: yearMatch ? Number(yearMatch[1]) : null,
    dimensionsText,
    dimensions: parseDimensions(dimensionsText),
    descriptionBlocks,
    description: blocksToPlainText(descriptionBlocks) || null,
    series: linksFor("collection")[0] ?? null,
    periods: linksFor("period"),
    styles: linksFor("style"),
    techniques: linksFor("technique"),
    images,
  };
}

/** `/collections/<artist>.html`: name heading plus biography paragraphs. */
export function extractArtist(html) {
  const root = stripChrome(parseLegacyHtml(html));
  const heading = root.querySelector("h3.h-featured_artist") ?? root.querySelector("h1");
  const container = heading?.parentNode;
  const bioBlocks = [];
  if (container) {
    for (const p of container.querySelectorAll("p")) {
      const spans = inlineSpans(p);
      if (spans.length > 0) bioBlocks.push({ type: "richText", spans });
    }
  }
  const portrait = container?.querySelector("img");
  return {
    name: clean(heading?.text) || null,
    bio: blocksToPlainText(bioBlocks) || null,
    portrait: portrait ? absolute(portrait.getAttribute("src")) : null,
  };
}

/** `/art-collection/<series>.html`: series name plus the artists linked from its grid. */
export function extractSeries(html) {
  const root = stripChrome(parseLegacyHtml(html));
  const name = clean(
    root.querySelector("h3.h-featured_artist")?.text ?? root.querySelector("h1")?.text,
  );
  const artistPaths = root
    .querySelectorAll("article.portfolio-item a")
    .map((a) => absolute(a.getAttribute("href")))
    .filter((url) => url && /\/collections\/[^/]+\.html$/.test(url))
    .map(legacyPath);
  return { name: name || null, artistLegacyPaths: [...new Set(artistPaths)] };
}

/** `/art-style|art-technique|art-period/<slug>.html`: name and optional intro copy. */
export function extractTaxonomy(html) {
  const root = stripChrome(parseLegacyHtml(html));
  const heading = root.querySelector("h3.h-featured_artist") ?? root.querySelector("h1");
  const intro = clean(heading?.parentNode.querySelector("p")?.text);
  return { name: clean(heading?.text) || null, intro: intro || null };
}

function largestContentBlock(root) {
  return root
    .querySelectorAll(".main-html--data")
    .sort((a, b) => clean(b.text).length - clean(a.text).length)[0];
}

const MIN_SECTION_TEXT = 40;

/** Pages built from bespoke sections (no CMS body) keep every substantial section, in order. */
function contentBlocks(root) {
  const main = largestContentBlock(root);
  const mainBlocks = main ? htmlToBlocks(main) : [];
  const sections = root
    .querySelectorAll("section")
    .filter((section) => !section.querySelector("section"))
    .filter((section) => clean(section.text).length >= MIN_SECTION_TEXT);
  const sectionText = sections.reduce((total, section) => total + clean(section.text).length, 0);
  if (main && clean(main.text).length * 2 >= sectionText) return mainBlocks;
  return sections.flatMap((section) => htmlToBlocks(section));
}

/** `/news/<slug>.html`: title, cover image and article body. */
export function extractStory(html) {
  const root = stripChrome(parseLegacyHtml(html));
  const title = clean(root.querySelector("h1")?.text);
  const coverImg = root.querySelector(".div-img img");
  const cover = coverImg
    ? {
        url: absolute(coverImg.getAttribute("src")),
        alt: clean(coverImg.getAttribute("alt")) || null,
      }
    : null;
  const bodyEl = largestContentBlock(root);
  return {
    title: title || null,
    cover: cover?.url ? cover : null,
    body: bodyEl ? htmlToBlocks(bodyEl) : [],
  };
}

/** Single CMS pages: FAQ boxes become an FAQ group, everything else rich text. */
export function extractPage(html) {
  const root = stripChrome(parseLegacyHtml(html));
  const title = clean(root.querySelector("h1")?.text);
  const faqItems = root
    .querySelectorAll(".faq-box")
    .map((box) => {
      const question = clean(box.querySelector("h2,h3,h4")?.text);
      const answerEl = box.querySelector("p");
      const answer = answerEl ? inlineSpans(answerEl) : [];
      return question && answer.length > 0 ? { question: question.slice(0, 500), answer } : null;
    })
    .filter(Boolean);
  if (faqItems.length > 0) {
    return { title: title || null, body: [{ type: "faqGroup", items: faqItems }] };
  }
  return { title: title || null, body: contentBlocks(root) };
}

/** `/glossary?word=X`: term/definition pairs for one letter. */
export function extractGlossaryTerms(html) {
  const root = stripChrome(parseLegacyHtml(html));
  return root
    .querySelectorAll(".glossary-box-1")
    .map((box) => {
      const [term, definition] = box.querySelectorAll(":scope > div").map((div) => clean(div.text));
      return term && definition ? { term, definition } : null;
    })
    .filter(Boolean);
}

/** Merges per-letter glossary pages into one page body, A–Z. */
export function glossaryBlocks(termsByLetter) {
  const blocks = [];
  for (const letter of [...termsByLetter.keys()].sort()) {
    const terms = termsByLetter.get(letter);
    if (terms.length === 0) continue;
    blocks.push({ type: "heading", level: 2, text: letter });
    blocks.push({
      type: "faqGroup",
      items: terms.map(({ term, definition }) => ({
        question: term.slice(0, 500),
        answer: [{ text: definition }],
      })),
    });
  }
  return blocks;
}
