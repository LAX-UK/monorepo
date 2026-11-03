import {
  SUBJECT_EXPORT_PRODUCT_INFO,
  type SubjectExportProduct,
} from "@auction/identity-contracts";
import { controllerNamesFor } from "./controller-names.js";
import type { CollectedProduct } from "./product-collector.js";
import { MANIFEST_FILE_NAME, README_FILE_NAME } from "./readme.renderer.js";
import {
  ICO,
  NOT_HELD_BY_LAX,
  PRODUCT_DISCLOSURES,
  RIGHTS,
  RIGHTS_CONTACTS,
} from "./summary.content.js";

export type SummaryInput = {
  preparedAt: Date;
  /** Who the copy is for, taken from the person's own account record. */
  recipient: { name: string | null; email: string | null };
  products: readonly CollectedProduct[];
  /** Uploaded files left out of the ZIP, named in the data files too. */
  omittedFileCount: number;
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const londonDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Europe/London",
});
const londonTime = new Intl.DateTimeFormat("en-GB", {
  timeStyle: "short",
  timeZone: "Europe/London",
});

function londonDateTime(date: Date): string {
  return `${londonDate.format(date)} at ${londonTime.format(date)}`;
}

const STYLE = `
:root{--bg:#fff;--fg:#14211f;--muted:#4a5b58;--line:#d5dedc;--accent:#0b6b62;--card:#f4f8f7}
@media (prefers-color-scheme:dark){:root{--bg:#0e1514;--fg:#e8f0ee;--muted:#a9bbb7;--line:#2b3b38;--accent:#62d0c4;--card:#16201f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 Montserrat,Outfit,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent);text-underline-offset:2px}
a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.skip{position:absolute;left:-999px}.skip:focus{left:16px;top:16px;background:var(--bg);padding:8px 12px;z-index:1}
header,main,footer{max-width:60rem;margin:0 auto;padding:0 16px}
header{padding-top:24px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.brand{font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:600;margin:0}
h1{font-size:2rem;line-height:1.2;margin:.4em 0 .2em}
h2{font-size:1.4rem;margin:2.2em 0 .6em;scroll-margin-top:16px}
h3{font-size:1.1rem;margin:1.6em 0 .4em}
p,li{max-width:46rem}
.muted{color:var(--muted)}
.cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));padding:0;list-style:none}
.cards li{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.cards h3{margin:0 0 .3em;font-size:1rem}
dl{margin:0}dt{font-weight:600}dd{margin:0 0 .4em}
.counts{display:grid;grid-template-columns:1fr auto;gap:2px 12px}.counts dd{text-align:right;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;margin:.6em 0}
caption{text-align:left;font-weight:600;padding:.4em 0}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.85rem;color:var(--muted)}
td.n{text-align:right;font-variant-numeric:tabular-nums}
nav ul{padding-left:1.2em}
.table-wrap{overflow-x:auto}
footer{padding-top:24px;padding-bottom:40px;border-top:1px solid var(--line);margin-top:3em}
@media print{.skip{display:none}a{color:inherit}h2{break-after:avoid}table,li{break-inside:avoid}}
`;

function list(items: readonly string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function counts(collected: CollectedProduct): string {
  const held = collected.categories.filter((category) => category.count > 0);
  const empty = collected.categories.filter((category) => category.count === 0);
  const rows = held.length
    ? `<dl class="counts">${held
        .map(
          (category) =>
            `<dt>${escapeHtml(category.definition.title)}</dt><dd>${category.count}</dd>`,
        )
        .join("")}</dl>`
    : "<p>Nothing held.</p>";
  const none = empty.length
    ? `<p class="muted">Nothing held in: ${escapeHtml(empty.map((c) => c.definition.title).join(", "))}.</p>`
    : "";
  return rows + none;
}

function productTable(collected: CollectedProduct): string {
  const info = SUBJECT_EXPORT_PRODUCT_INFO[collected.product];
  const rows = collected.categories
    .map(
      (category) => `<tr>
<th scope="row">${escapeHtml(category.definition.title)}</th>
<td>${escapeHtml(category.definition.description)}</td>
<td class="n">${category.count}</td>
<td><a href="${escapeHtml(category.zipPath)}">${escapeHtml(category.zipPath)}</a></td>
</tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table>
<caption>${escapeHtml(info.name)}: what is in each file</caption>
<thead><tr><th scope="col">Section</th><th scope="col">What it holds</th><th scope="col">Records</th><th scope="col">File</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>`;
}

function productSection(collected: CollectedProduct): string {
  const { product } = collected;
  const info = SUBJECT_EXPORT_PRODUCT_INFO[product];
  return `<section aria-labelledby="sec-${product}">
<h2 id="sec-${product}">${escapeHtml(info.name)}</h2>
<p class="muted">Kept by ${escapeHtml(controllerNamesFor(product))}.</p>
${productTable(collected)}
</section>`;
}

function aboutSection(products: readonly SubjectExportProduct[]): string {
  const parts = products.map((product) => {
    const info = SUBJECT_EXPORT_PRODUCT_INFO[product];
    const text = PRODUCT_DISCLOSURES[product];
    return `<section aria-labelledby="about-${product}">
<h3 id="about-${product}">${escapeHtml(info.name)}</h3>
<h4>Why it is used</h4>${list(text.purposes)}
<h4>Who it is shared with</h4>${list(text.recipients)}
<h4>How long it is kept</h4>${list(text.retention)}
<h4>Where it came from</h4>${list(text.sources)}
</section>`;
  });
  return `<section aria-labelledby="about">
<h2 id="about">About your data</h2>
<p>Each company below is responsible for the data in its own folder. Its privacy notice has the full detail.</p>
${parts.join("\n")}
<h3 id="not-held">Not held by LAX, or not in this copy</h3>
<dl>${NOT_HELD_BY_LAX.map((gap) => `<dt>${escapeHtml(gap.title)}</dt><dd>${escapeHtml(gap.detail)}</dd>`).join("")}</dl>
</section>`;
}

function rightsSection(): string {
  const contacts = RIGHTS_CONTACTS.map(
    (
      contact,
    ) => `<li><strong>${escapeHtml(contact.heading)}</strong>: ${escapeHtml(contact.company)}, ${escapeHtml(contact.address)}.
Email <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>${
      contact.phone ? `, telephone ${escapeHtml(contact.phone)}` : ""
    }.</li>`,
  ).join("");
  return `<section aria-labelledby="rights">
<h2 id="rights">Your rights and how to ask for more</h2>
<p>You can:</p>
${list(RIGHTS)}
<p>Write to the company that holds the data. We normally answer within one month.</p>
<ul>${contacts}</ul>
<p>If you are not happy with an answer, you can complain to ${escapeHtml(ICO.name)}: <a href="${escapeHtml(ICO.url)}">${escapeHtml(ICO.url)}</a>, telephone ${escapeHtml(ICO.phone)}.</p>
</section>`;
}

/**
 * "Your LAX data.html": the readable summary at the top of the ZIP. One self-contained file: no
 * scripts, fonts or images are loaded, so it opens offline in any browser, works on a phone,
 * follows the reader's light or dark setting and prints to PDF.
 */
export function renderSummary(input: SummaryInput): string {
  const { recipient, products } = input;
  const productIds = products.map((p) => p.product);
  const names = products.map((p) => SUBJECT_EXPORT_PRODUCT_INFO[p.product].name);
  const who = [recipient.name, recipient.email ? `(${recipient.email})` : null]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  const nav = [
    ...products.map((p) => ({
      id: `sec-${p.product}`,
      label: SUBJECT_EXPORT_PRODUCT_INFO[p.product].name,
    })),
    { id: "about", label: "About your data" },
    { id: "rights", label: "Your rights and how to ask for more" },
  ];
  const omitted = input.omittedFileCount
    ? `<p><strong>${input.omittedFileCount} uploaded ${input.omittedFileCount === 1 ? "file is" : "files are"} not in this ZIP.</strong> They are listed in the data files with the reason. Ask us and we will send them separately.</p>`
    : "";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Your LAX data, prepared ${escapeHtml(londonDate.format(input.preparedAt))}</title>
<style>${STYLE}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the summary</a>
<header>
<p class="brand">LAX Account</p>
<h1>Your LAX data</h1>
<p>Prepared${who ? ` for ${escapeHtml(who)}` : ""} on ${escapeHtml(londonDateTime(input.preparedAt))} (London time). This copy covers ${escapeHtml(names.join(", "))}.</p>
</header>
<main id="main">
<section aria-labelledby="counts">
<h2 id="counts">What is in this copy</h2>
<ul class="cards">${products
    .map(
      (collected) =>
        `<li><h3>${escapeHtml(SUBJECT_EXPORT_PRODUCT_INFO[collected.product].name)}</h3>${counts(collected)}</li>`,
    )
    .join("")}</ul>
${omitted}
<p class="muted">The data files are JSON, which spreadsheets and other services can read. <a href="${README_FILE_NAME.replace(/ /g, "%20")}">${README_FILE_NAME}</a> explains every file and field, and <a href="${MANIFEST_FILE_NAME}">${MANIFEST_FILE_NAME}</a> lists them with checksums.</p>
</section>
<nav aria-label="Sections"><h2>Sections</h2><ul>${nav
    .map((item) => `<li><a href="#${item.id}">${escapeHtml(item.label)}</a></li>`)
    .join("")}</ul></nav>
${products.map(productSection).join("\n")}
${aboutSection(productIds)}
${rightsSection()}
</main>
<footer><p class="muted">Prepared by LAX. Keep this file safe: it holds personal information.</p></footer>
</body>
</html>
`;
}
