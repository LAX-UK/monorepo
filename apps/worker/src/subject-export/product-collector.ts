import {
  SUBJECT_EXPORT_CATEGORIES,
  SUBJECT_EXPORT_PRODUCT_INFO,
  type SubjectExportCategoryDefinition,
  type SubjectExportProduct,
  subjectExportSchemaName,
} from "@auction/identity-contracts";
import type { ArchiveBudget } from "./archive-budget.js";
import { controllerNamesFor } from "./controller-names.js";
import type { ExportFileMaterialiser } from "./export-file-materialiser.js";
import type { ExportStaging } from "./export-staging.js";
import { mapFileRefs } from "./file-refs.js";
import type { ProductExportSource } from "./product-export-source.js";
import { permanentError, transientError } from "./subject-export.errors.js";

/** More pages than this for one category means the product is not finishing its paging. */
const MAX_PAGES_PER_CATEGORY = 100_000;

/** What was gathered for one category: what the summary, the README and Identity's audit need. */
export type CollectedCategory = {
  definition: SubjectExportCategoryDefinition;
  schemaVersion: number;
  /** Records actually written, which is what the person gets. */
  count: number;
  /** Path of the data file inside the ZIP. */
  zipPath: string;
};

export type CollectedProduct = {
  product: SubjectExportProduct;
  categories: CollectedCategory[];
};

export type ProductCollectionInput = {
  product: SubjectExportProduct;
  subjectId: string;
  source: ProductExportSource;
  staging: ExportStaging;
  budget: ArchiveBudget;
  files: ExportFileMaterialiser;
  generatedAt: Date;
  signal: AbortSignal;
};

/**
 * Gathers one product's data into the staging directory: its manifest, then every category page
 * by page with the cursor, one data file per category. Every category the contract lists gets a
 * file even when the product holds nothing, so "nothing held" is stated, not implied.
 */
export async function collectProduct(input: ProductCollectionInput): Promise<CollectedProduct> {
  const { product, subjectId, source, staging, budget, files, signal } = input;
  const info = SUBJECT_EXPORT_PRODUCT_INFO[product];
  const manifest = await source.manifest(subjectId, signal);
  const known = new Set(SUBJECT_EXPORT_CATEGORIES[product].map((category) => category.id));
  if (manifest.categories.some((category) => !known.has(category.id))) {
    // The product is ahead of this worker; a deploy of the worker settles it, so it is retried.
    throw transientError("product_ahead_of_worker", product);
  }
  const listed = new Map(manifest.categories.map((category) => [category.id, category]));

  const categories: CollectedCategory[] = [];
  for (const definition of SUBJECT_EXPORT_CATEGORIES[product]) {
    const schemaVersion = listed.get(definition.id)?.schemaVersion ?? definition.schemaVersion;
    const writer = await staging.openJson(`${product}/${definition.id}.json`, {
      schema: subjectExportSchemaName(product, definition.id, schemaVersion),
      product: info.name,
      controller: controllerNamesFor(product),
      generatedAt: input.generatedAt.toISOString(),
    });
    try {
      if (listed.has(definition.id)) {
        let cursor: string | null = null;
        const seen = new Set<string>();
        for (let pageNumber = 0; ; pageNumber += 1) {
          if (pageNumber >= MAX_PAGES_PER_CATEGORY)
            throw permanentError("product_paging_runaway", product);
          const page = await source.page(subjectId, definition.id, cursor, signal);
          for (const record of page.records) {
            const resolved = await mapFileRefs(record, (ref) =>
              files.materialise(
                { product, categoryId: definition.id, recordId: record.id },
                ref,
                signal,
              ),
            );
            await writer.append(resolved);
          }
          cursor = page.nextCursor;
          if (cursor === null) break;
          if (seen.has(cursor)) throw permanentError("product_cursor_loop", product);
          seen.add(cursor);
        }
      }
    } catch (error) {
      writer.abort();
      throw error;
    }
    const closed = await writer.close();
    staging.add({
      zipPath: closed.zipPath,
      diskPath: closed.diskPath,
      bytes: closed.bytes,
      compress: closed.compress,
    });
    budget.admitData(closed.bytes);
    categories.push({
      definition,
      schemaVersion,
      count: closed.records,
      zipPath: closed.zipPath,
    });
  }
  return { product, categories };
}
