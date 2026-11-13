import { parseOrgConfigs } from "@auction/accounting-zoho-books";
import type { BooksDocumentLink } from "../interfaces/accounting-queue.js";
import type { BooksAccountingEnv } from "./create-books-accounting-adapters.js";

/** The Books web app (EU data centre, where LAX's organisations are). */
const BOOKS_APP = "https://books.zoho.eu/app";

const PATH: Readonly<Record<Parameters<BooksDocumentLink>[0]["documentType"], string>> = {
  invoice: "invoices",
  payment: "paymentsreceived",
  credit_note: "creditnotes",
  bill: "bills",
  contact: "contacts",
};

const noLinks: BooksDocumentLink = () => null;

/**
 * Links to documents in Books, from the same organisation settings the worker uses. A rehearsal
 * (`dry_run`) made nothing in Books, so it has no link; nor has a company with no organisation.
 * Settings that cannot be read give no links rather than stopping the page.
 */
export function createBooksDocumentLinks(env: BooksAccountingEnv): BooksDocumentLink {
  const raw = env.ZOHO_BOOKS_ORG_CONFIG?.trim();
  if (!raw) return noLinks;
  let orgs: ReturnType<typeof parseOrgConfigs>;
  try {
    orgs = parseOrgConfigs(JSON.parse(raw));
  } catch {
    return noLinks;
  }
  return ({ organisation, documentType, targetMode, booksId }) => {
    const org = orgs[organisation];
    if (!org || targetMode === null || targetMode === "dry_run") return null;
    if (!/^[0-9]{1,32}$/.test(booksId)) return null;
    return `${BOOKS_APP}/${org.organizationId}#/${PATH[documentType]}/${booksId}`;
  };
}
