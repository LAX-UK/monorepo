import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVerificationTargets,
  checkDestination,
  checkRedirectHop,
  expectedLegacyTarget,
  parityGaps,
} from "./lib/legacy-redirect-verify.mjs";
import { buildLegacyExport } from "./lib/legacy-thelax-export.mjs";
import {
  extractArtwork,
  extractGlossaryTerms,
  extractPage,
  extractSeo,
  htmlToBlocks,
  parseDimensions,
  parseLegacyHtml,
} from "./lib/legacy-thelax-extract.mjs";
import {
  buildGoldList,
  legacyKey,
  parseCsv,
  readGa4LandingPages,
  readLinkedPages,
  readSearchConsolePages,
} from "./lib/legacy-thelax-gold-list.mjs";
import { classifyLegacyUrl, parseSitemapLocs } from "./lib/legacy-thelax-urls.mjs";

const HEAD = `<head><title>A Flower for a Viewer by Mr Phantom | Art for Sale | LAX</title>
<meta name="description" content="Buy A Flower for a Viewer.">
<link rel="canonical" href="https://www.thelax.art/collection/a-flower.html">
<meta name="robots" content="index, follow"></head>`;

const ARTWORK_HTML = `<html>${HEAD}<body><header><a href="/collections/nav-artist.html">Nav</a></header>
<div class="row"><div class="col-md-6">
  <div class="slide"><a href="https://www.thelax.art/uds/stock/1.jpeg" data-lightbox="g"><img src="https://www.thelax.art/uds/stock/thumb/1.jpeg" alt="Front"></a></div>
  <div class="slide"><a href="https://www.thelax.art/uds/stock/1.jpeg" data-lightbox="g"><img alt="dupe"></a></div>
  <div class="slide"><a href="https://www.thelax.art/uds/stock/2.jpeg" data-lightbox="g"><img alt="Detail"></a></div>
</div>
<div class="col-md-6">
  <h2 class="h-featured_artist">Mr Phantom </h2>
  <h1>*SOLD* A Flower for a Viewer</h1>
  <div class="main-html--data"><span class="f-w-7">Date:</span> 2025</div>
  <div class="main-html--data"><span class="f-w-7">Dimensions:</span> 60 x 50 x 4 cm</div>
  <button data-bs-target="#uniqueWorkModal"><span>Unique work</span></button>
  <button data-bs-target="#coaModal"><span>Includes a Certificate of Authenticity</span></button>
  <div class="main-html--data mt-4"><div class="mb-4"><a href="javascript:void(0);" class="btn btn-danger"> SOLD </a></div></div>
</div></div>
<div class="row"><div class="col-md-6"><h4>Description</h4>
  <div class="border p-3 bg-white main-html--data"><p>A child <b>offers</b> a <a href="/news/abstract-art.html">flower</a>.</p></div></div>
<div class="col-md-6"><h4>About the work</h4><div class="border">
  <div class="d-flex"><span class="f-w-6">Collection:</span><span><a href="https://www.thelax.art/art-collection/gac-vs-gas.html"> GAC vs GAS </a></span></div>
  <div class="d-flex"><span class="f-w-6">Style:</span><span><a href="https://www.thelax.art/art-style/street-art.html"> Street Art </a></span></div>
</div></div></div>
<div class="f-s-24 h-featured_artist">MORE ARTWORKS BY Mr Phantom</div>
<article class="portfolio-item"><a href="https://www.thelax.art/collections/mr-phantom.html" class="h-featured_artist">Mr Phantom</a></article>
</body></html>`;

const PRINT_HTML = `<html>${HEAD}<body><div class="row"><div class="col-md-6">
  <h2 class="h-featured_artist">Pierre Simone</h2><h1>a guy named rick</h1>
  <div class="main-html--data mt-4"><a href="https://www.thelax.art/collection/a-guy-named-rick.html" class="btn btn-dark"><span>Check Original : SOLD</span></a>
  <button class="buy-now"><span>Buy Now</span></button></div>
</div></div></body></html>`;

describe("classifyLegacyUrl", () => {
  it("classifies every legacy family", () => {
    assert.deepEqual(classifyLegacyUrl("https://www.thelax.art/"), { family: "home" });
    assert.deepEqual(classifyLegacyUrl("https://www.thelax.art/collection/Sold-Lust.html"), {
      family: "artwork",
      kind: "original",
      slug: "sold-lust",
    });
    assert.equal(classifyLegacyUrl("/print/a.html").kind, "print");
    assert.equal(classifyLegacyUrl("/sculpture/a.html").kind, "sculpture");
    assert.deepEqual(classifyLegacyUrl("/collections/mr-phantom.html"), {
      family: "artist",
      slug: "mr-phantom",
    });
    assert.equal(classifyLegacyUrl("/art-collection/7-sins.html").family, "series");
    assert.equal(classifyLegacyUrl("/news/abstract-art.html").family, "story");
    assert.deepEqual(classifyLegacyUrl("/art-technique/oil.html"), {
      family: "taxonomy",
      taxonomy: "technique",
      slug: "oil",
    });
    assert.deepEqual(classifyLegacyUrl("/glossary?word=b&order=1"), {
      family: "glossary",
      letter: "B",
    });
    assert.deepEqual(classifyLegacyUrl("/about-us"), { family: "page", slug: "about-us" });
    assert.deepEqual(classifyLegacyUrl("/uds/stock/1.jpeg"), { family: "unknown" });
  });

  it("reads sitemap locations and unescapes ampersands", () => {
    const xml =
      "<urlset><url><loc> https://www.thelax.art/glossary?word=A&amp;order=1 </loc></url></urlset>";
    assert.deepEqual(parseSitemapLocs(xml), ["https://www.thelax.art/glossary?word=A&order=1"]);
  });
});

describe("extractors", () => {
  it("reads the SEO surface", () => {
    const seo = extractSeo(parseLegacyHtml(ARTWORK_HTML));
    assert.equal(seo.title, "A Flower for a Viewer by Mr Phantom | Art for Sale | LAX");
    assert.equal(seo.description, "Buy A Flower for a Viewer.");
    assert.equal(seo.canonical, "https://www.thelax.art/collection/a-flower.html");
    assert.equal(seo.robots, "index, follow");
  });

  it("extracts artwork details, sold state, taxonomy links and de-duplicated images", () => {
    const work = extractArtwork(ARTWORK_HTML);
    assert.equal(work.title, "A Flower for a Viewer");
    assert.equal(work.artistName, "Mr Phantom");
    assert.equal(work.artistLegacyPath, "/collections/mr-phantom.html");
    assert.equal(work.sold, true);
    assert.equal(work.unique, true);
    assert.equal(work.certificate, true);
    assert.equal(work.year, 2025);
    assert.deepEqual(work.dimensions, { heightCm: 60, widthCm: 50, depthCm: 4 });
    assert.equal(work.description, "A child offers a flower.");
    assert.deepEqual(work.series, {
      name: "GAC vs GAS",
      legacyPath: "/art-collection/gac-vs-gas.html",
    });
    assert.deepEqual(work.styles, [
      { name: "Street Art", legacyPath: "/art-style/street-art.html" },
    ]);
    assert.deepEqual(
      work.images.map((image) => [image.url, image.alt]),
      [
        ["https://www.thelax.art/uds/stock/1.jpeg", "Front"],
        ["https://www.thelax.art/uds/stock/2.jpeg", "Detail"],
      ],
    );
  });

  it("does not treat a print's sold original as a sold print", () => {
    const print = extractArtwork(PRINT_HTML);
    assert.equal(print.sold, false);
    assert.equal(print.originalLegacyPath, "/collection/a-guy-named-rick.html");
  });

  it("converts WYSIWYG HTML into editorial blocks with absolute legacy links", () => {
    const root = parseLegacyHtml(
      `<div><p>Intro <span style="font-weight: bold;">bold</span> <a href="/artist">artist</a></p>
       <h1>Big</h1><h5>Small</h5><ul><li>One</li><li>Two</li></ul>
       <p><img src="/uds/articles/1.jpg" alt="Cover"></p><blockquote>Quote</blockquote>
       <iframe src="https://www.youtube.com/embed/x" title="Film"></iframe><p> </p></div>`,
    );
    assert.deepEqual(htmlToBlocks(root.querySelector("div")), [
      {
        type: "richText",
        spans: [
          { text: "Intro " },
          { text: "bold", marks: ["bold"] },
          { text: " " },
          { text: "artist", marks: ["link"], href: "https://www.thelax.art/artist" },
        ],
      },
      { type: "heading", level: 2, text: "Big" },
      { type: "heading", level: 4, text: "Small" },
      { type: "richText", spans: [{ text: "• One" }] },
      { type: "richText", spans: [{ text: "• Two" }] },
      { type: "image", mediaKey: "https://www.thelax.art/uds/articles/1.jpg", alt: "Cover" },
      { type: "quote", text: "Quote" },
      { type: "video", url: "https://www.youtube.com/embed/x", title: "Film" },
    ]);
  });

  it("turns FAQ boxes into an FAQ group and reads glossary terms", () => {
    const faq = extractPage(
      `<h1>FAQ</h1><section><div class="faq-box"><h2>Q1?</h2><p>A1.</p></div>
       <div class="faq-box"><h2>Q2?</h2><p></p></div></section>`,
    );
    assert.deepEqual(faq.body, [
      { type: "faqGroup", items: [{ question: "Q1?", answer: [{ text: "A1." }] }] },
    ]);
    const terms = extractGlossaryTerms(
      `<div class="glossary-box-1"><div>Abstract art</div><div>Non-figurative art.</div></div>`,
    );
    assert.deepEqual(terms, [{ term: "Abstract art", definition: "Non-figurative art." }]);
  });

  it("parses dimensions in cm, mm and inches", () => {
    assert.deepEqual(parseDimensions("70 x 60  cm"), { heightCm: 70, widthCm: 60, depthCm: null });
    assert.deepEqual(parseDimensions("500 × 400 mm"), { heightCm: 50, widthCm: 40, depthCm: null });
    assert.deepEqual(parseDimensions("10 x 20 in"), {
      heightCm: 25.4,
      widthCm: 50.8,
      depthCm: null,
    });
    assert.equal(parseDimensions("Variable"), null);
  });
});

describe("buildLegacyExport", () => {
  it("assigns series to the artist most of their works link to and merges the glossary", () => {
    const exported = buildLegacyExport(
      [
        { url: "https://www.thelax.art/collection/a-flower.html", body: ARTWORK_HTML },
        {
          url: "https://www.thelax.art/art-collection/gac-vs-gas.html",
          body: `<h1 class="d-none">GAC vs GAS</h1>`,
        },
        {
          url: "https://www.thelax.art/glossary?word=B&order=1",
          body: `<div class="glossary-box-1"><div>Baroque</div><div>Ornate style.</div></div>`,
        },
        {
          url: "https://www.thelax.art/glossary?word=A&order=1",
          body: `<div class="glossary-box-1"><div>Abstract</div><div>Shapes.</div></div>`,
        },
      ],
      { origin: "https://www.thelax.art", generatedAt: "2026-10-13T00:00:00.000Z" },
    );
    assert.equal(exported.schemaVersion, 1);
    assert.equal(exported.artworks[0].slug, "a-flower");
    assert.equal(
      exported.artworks[0].seoTitle,
      "A Flower for a Viewer by Mr Phantom | Art for Sale | LAX",
    );
    assert.deepEqual(exported.series, [
      {
        legacyPath: "/art-collection/gac-vs-gas.html",
        slug: "gac-vs-gas",
        name: "GAC vs GAS",
        artistLegacyPath: "/collections/mr-phantom.html",
      },
    ]);
    const glossary = exported.pages.find((page) => page.slug === "glossary");
    assert.deepEqual(
      glossary.body.filter((block) => block.type === "heading").map((block) => block.text),
      ["A", "B"],
    );
    assert.deepEqual(glossary.body[1], {
      type: "faqGroup",
      items: [{ question: "Abstract", answer: [{ text: "Shapes." }] }],
    });
  });
});

describe("gold list", () => {
  it("parses quoted CSV and skips GA4 comment preambles", () => {
    assert.deepEqual(parseCsv('# GA4\n"a,b",c\n"say ""hi""",d\n'), [
      ["a,b", "c"],
      ['say "hi"', "d"],
    ]);
  });

  it("normalises legacy keys across hosts and ignores other domains", () => {
    assert.equal(legacyKey("https://thelax.art/news/a.html?utm_source=x"), "/news/a.html");
    assert.equal(legacyKey("https://www.thelax.art/glossary?word=c"), "/glossary?word=C&order=1");
    assert.equal(legacyKey("https://example.com/news/a.html"), null);
  });

  it("unions top clicks, top sessions and backlinked URLs and flags inventory gaps", () => {
    const pages = readSearchConsolePages(
      "Top pages,Clicks,Impressions\nhttps://www.thelax.art/news/a.html,120,900\nhttps://www.thelax.art/news/b.html,5,40\nhttps://www.thelax.art/news/c.html,1,4\n",
    );
    const links = readLinkedPages("Target page,Linking sites\nhttps://www.thelax.art/old.html,3\n");
    const landing = readGa4LandingPages("# GA4 export\nLanding page,Sessions\n/news/c.html,80\n");
    const gold = buildGoldList({
      pages,
      links,
      landing,
      inventoryPaths: new Set(["/news/a.html", "/news/b.html", "/news/c.html"]),
      top: 1,
    });
    assert.deepEqual(
      gold.map((item) => [item.path, item.reasons]),
      [
        ["/news/a.html", ["top-1-clicks"]],
        ["/news/c.html", ["top-1-organic-sessions"]],
        ["/old.html", ["backlinked", "not-in-inventory"]],
      ],
    );
  });
});

describe("legacy redirect verification", () => {
  const redirects = {
    "/about-us": "/collector-hub/about-us",
    "/collection/a-flower.html": "/artworks/a-flower",
    "/art-style/abstract.html": "/artworks",
    "/art-collection/s1.html": "/artists/mr-phantom",
    "/collections/mr-phantom.html": "/artists/mr-phantom",
    "/glossary": "/collector-hub/glossary",
    "/prev-auction": "https://lax.bid/archive",
    "/all-prints": "/prints",
  };
  const ORIGIN = "https://www.thelax.art";
  const page = ({ canonical, robots = "index, follow", title = "T", description = "D" }) =>
    `<html><head><title>${title}</title><meta name="description" content="${description}">` +
    `<link rel="canonical" href="${canonical}"><meta name="robots" content="${robots}"></head></html>`;

  it("derives the mapped target, dropping legacy query params and case", () => {
    assert.deepEqual(expectedLegacyTarget("/", redirects), { path: "/", redirect: false });
    assert.deepEqual(expectedLegacyTarget("/glossary?word=A&order=1", redirects), {
      path: "/collector-hub/glossary",
      redirect: true,
    });
    assert.deepEqual(expectedLegacyTarget("/About-Us/", redirects), {
      path: "/collector-hub/about-us",
      redirect: true,
    });
    assert.deepEqual(expectedLegacyTarget("/paintings", redirects), {
      path: "/paintings",
      redirect: false,
    });
  });

  it("merges inventory and gold sources, skipping URLs that were not live", () => {
    const targets = buildVerificationTargets({
      inventory: {
        entries: [
          { path: "/about-us", family: "page", status: 200 },
          { path: "/dead.html", family: "unknown", status: 404 },
        ],
      },
      gold: { entries: [{ path: "/about-us" }, { path: "/missing.html" }] },
      redirects,
    });
    assert.deepEqual(
      targets.map((t) => [t.path, t.sources, t.expected?.path ?? null]),
      [
        ["/about-us", ["inventory", "gold"], "/collector-hub/about-us"],
        ["/missing.html", ["gold"], "/missing.html"],
      ],
    );
  });

  it("requires exactly one 301 to the mapped path on the canonical origin", () => {
    const hop = (response, path, sources = ["inventory"]) =>
      checkRedirectHop(
        response,
        { sources, expected: expectedLegacyTarget(path, redirects) },
        ORIGIN,
      );
    const flower = "/collection/a-flower.html";
    assert.deepEqual(hop({ status: 301, location: `${ORIGIN}/artworks/a-flower` }, flower), {
      outcome: "pass",
      issues: [],
    });
    assert.match(hop({ status: 308, location: "/x" }, flower).issues[0], /expected 301/);
    assert.match(
      hop({ status: 301, location: `${ORIGIN}/artworks` }, flower).issues[0],
      /expected https:\/\/www\.thelax\.art\/artworks\/a-flower$/,
    );
    assert.equal(
      hop({ status: 301, location: "https://lax.art/artworks/a-flower" }, flower).outcome,
      "fail",
    );
    assert.equal(
      hop({ status: 301, location: "https://lax.bid/archive" }, "/prev-auction").outcome,
      "pass",
    );
    assert.equal(hop({ status: 200 }, "/").outcome, "pass");
  });

  it("expects pages that moved to another product to redirect there in one permanent hop", () => {
    const hop = (response, path) =>
      checkRedirectHop(
        response,
        { sources: ["inventory"], expected: expectedLegacyTarget(path, redirects) },
        ORIGIN,
      );
    assert.deepEqual(expectedLegacyTarget("/prints", redirects), {
      path: "/artworks",
      redirect: true,
      anotherProduct: true,
    });
    const shop = "https://shop.lax.art/artworks";
    for (const path of ["/prints", "/all-prints"]) {
      assert.equal(hop({ status: 308, location: shop }, path).outcome, "pass");
      assert.equal(hop({ status: 301, location: shop }, path).outcome, "pass");
    }
    assert.match(hop({ status: 200 }, "/prints").issues[0], /permanent redirect/);
    assert.match(
      hop({ status: 301, location: `${ORIGIN}/prints` }, "/all-prints").issues[0],
      /expected \/artworks on another product/,
    );
    assert.equal(hop({ status: 301, location: `${ORIGIN}/artworks` }, "/prints").outcome, "fail");
  });

  it("treats unmapped 404s as retired unless the URL is on the gold list", () => {
    const target = (sources) => ({
      sources,
      expected: expectedLegacyTarget("/site-map", redirects),
    });
    assert.deepEqual(checkRedirectHop({ status: 404 }, target(["inventory"]), ORIGIN), {
      outcome: "retired",
      issues: ["retired: unmapped and 404"],
    });
    assert.equal(
      checkRedirectHop({ status: 404 }, target(["inventory", "gold"]), ORIGIN).outcome,
      "fail",
    );
    assert.equal(checkRedirectHop({ status: 500 }, target(["inventory"]), ORIGIN).outcome, "fail");
  });

  it("requires an indexable 200 destination with a self canonical, title and description", () => {
    const url = `${ORIGIN}/artworks/a-flower`;
    assert.deepEqual(checkDestination({ status: 200, body: page({ canonical: url }) }, url), []);
    assert.match(
      checkDestination({ status: 301, location: "/elsewhere" }, url)[0],
      /redirect chain/,
    );
    assert.match(checkDestination({ status: 404 }, url)[0], /returned 404/);
    assert.deepEqual(
      checkDestination({ status: 200, body: page({ canonical: `${ORIGIN}/artworks` }) }, url),
      [`canonical ${ORIGIN}/artworks is not self-referencing (${url})`],
    );
    const noindex = {
      status: 200,
      body: page({ canonical: url }),
      robotsHeader: "noindex, nofollow",
    };
    assert.deepEqual(checkDestination(noindex, url), ["destination is noindex"]);
    assert.deepEqual(checkDestination(noindex, url, { allowNoindex: true }), []);
    assert.deepEqual(
      checkDestination(
        { status: 200, body: page({ canonical: url, title: "", description: "" }) },
        url,
      ),
      ["missing title", "missing meta description"],
    );
  });

  it("reports listing landings and shared destinations as parity gaps", () => {
    const targets = buildVerificationTargets({
      inventory: {
        entries: [
          { path: "/art-style/abstract.html", family: "taxonomy", status: 200 },
          { path: "/art-collection/s1.html", family: "series", status: 200 },
          { path: "/collections/mr-phantom.html", family: "artist", status: 200 },
        ],
      },
      gold: null,
      redirects,
    });
    assert.deepEqual(
      parityGaps(targets).map((gap) => [gap.kind, gap.path]),
      [
        ["generic-destination", "/art-style/abstract.html"],
        ["many-to-one", "/artists/mr-phantom"],
      ],
    );
  });
});
