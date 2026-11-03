import {
  SUBJECT_EXPORT_CATEGORIES,
  SUBJECT_EXPORT_PRODUCTS,
  SUBJECT_EXPORT_PRODUCT_INFO,
  type SubjectExportOrigin,
  subjectExportSchemaName,
} from "@auction/identity-contracts";
import { controllerNamesFor } from "./controller-names.js";

export const SUMMARY_FILE_NAME = "Your LAX data.html";
export const README_FILE_NAME = "README.txt";
export const MANIFEST_FILE_NAME = "manifest.json";

const ORIGIN_MEANING: Record<SubjectExportOrigin, string> = {
  provided: "you typed it, chose it or uploaded it",
  observed: "your use of LAX produced it, for example a bid or a sign-in",
  made_by_us: "LAX set it about you, for example an approval status",
};

const RULE = "-".repeat(72);

/**
 * The README that ships in the ZIP. Every category and field is written from the same contract
 * the products validate their answers against, so the README cannot drift from the data: a
 * category or field added there appears here.
 */
export function renderReadme(input: { preparedAt: Date; exportId: string }): string {
  const lines: string[] = [
    "YOUR LAX DATA",
    "=============",
    "",
    `Prepared ${input.preparedAt.toISOString()} (UTC). Request ${input.exportId}.`,
    "",
    "This ZIP is a copy of the personal information LAX holds about you. Open",
    `"${SUMMARY_FILE_NAME}" in any web browser for a readable summary. Everything below`,
    "explains the data files that sit behind it.",
    "",
    "WHAT IS IN THE ZIP",
    RULE,
    `${SUMMARY_FILE_NAME}   A readable summary. It works offline and prints to PDF.`,
    `${README_FILE_NAME}              This file.`,
    `${MANIFEST_FILE_NAME}          Every file in the ZIP with its size and SHA-256 checksum, so you can`,
    "                       check nothing was changed or damaged.",
    ...SUBJECT_EXPORT_PRODUCTS.map((product) => {
      const info = SUBJECT_EXPORT_PRODUCT_INFO[product];
      return `${`${product}/`.padEnd(21)}${info.name}. Kept by ${controllerNamesFor(product)}.`;
    }),
    "<product>/files/      Files you uploaded to that product, such as invoices as PDF and photos.",
    "",
    "HOW THE DATA FILES WORK",
    RULE,
    "Each data file is JSON, a format any spreadsheet tool or programming language reads.",
    "Every file has the same shape:",
    "",
    "  schema        The file's kind and version, for example",
    `                ${subjectExportSchemaName("bid", "bids")}.`,
    "  product       The product the data comes from.",
    "  controller    The company responsible for that data.",
    "  generatedAt   When the file was prepared.",
    "  records       One entry per item. An empty list means we hold nothing in that category.",
    "",
    "Rules that apply to every file:",
    "  - Dates and times are ISO 8601 in UTC, for example 2026-11-02T14:03:11Z.",
    "    The summary shows London time.",
    '  - Money is given as "minor" units with a currency: 260000 minor units of GBP is',
    "    2,600.00 pounds. It is never a decimal number, so nothing is rounded.",
    "  - Every record has an id, which refers to the same record if you contact us later,",
    "    and an origin that says where it came from:",
    ...(Object.keys(ORIGIN_MEANING) as SubjectExportOrigin[]).map(
      (origin) => `      ${origin.padEnd(10)} ${ORIGIN_MEANING[origin]}`,
    ),
    "  - A file you uploaded appears in a record as an object. When it is in the ZIP,",
    '    "included" is true and "path" gives its place in the ZIP, with its checksum.',
    '    When it is not, "included" is false and a message says why. A file is left out',
    "    only if the ZIP would pass its size limit or the stored file could not be found.",
    "    The message tells you to ask us, and we will send it separately.",
    "",
  ];

  for (const product of SUBJECT_EXPORT_PRODUCTS) {
    const info = SUBJECT_EXPORT_PRODUCT_INFO[product];
    lines.push(
      `${info.name.toUpperCase()}  (folder ${product}/)`,
      RULE,
      `Kept by ${controllerNamesFor(product)}.`,
      "",
    );
    for (const category of SUBJECT_EXPORT_CATEGORIES[product]) {
      lines.push(
        `${product}/${category.id}.json  -  ${category.title}`,
        `  ${category.description}`,
        `  Origin of the records: ${category.origins.join(", ")}.`,
        "  Each record has:",
        "    id            A reference for this record.",
        "    origin        Where the record came from, as above.",
        ...category.fields.map((field) => `    ${field.name.padEnd(13)} ${field.description}`),
        "",
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
