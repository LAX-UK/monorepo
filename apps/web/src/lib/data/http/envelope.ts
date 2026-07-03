import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

export class HttpResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpResponseError";
  }
}

export type EnvelopeParseContext = {
  /** Included in zod parse failure messages (dev aid). */
  context?: string;
};

type NotOkMessage = string | ((status: number) => string);

function resolveNotOkMessage(status: number, message?: NotOkMessage): string {
  if (typeof message === "function") return message(status);
  return message ?? `Request failed: ${status}`;
}

function formatZodFailure(context: string | undefined, error: z.ZodError): Error {
  const summary = error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  const prefix = context ? `${context}: invalid response shape` : "Invalid response shape";
  return new Error(`${prefix}: ${summary}`);
}

function parseWithSchema<T>(value: unknown, schema: z.ZodType<T>, context?: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw formatZodFailure(context, result.error);
  }
  return result.data;
}

const envelopeSchema = z.object({ data: z.unknown() }).passthrough();

function readEnvelopeTotal(body: unknown, fallback: number): number {
  if (!isIndexableObject(body)) return fallback;

  const topLevelTotal = body.total;
  if (typeof topLevelTotal === "number" || typeof topLevelTotal === "string") {
    return Number(topLevelTotal);
  }

  const meta = body.meta;
  if (isIndexableObject(meta)) {
    const metaTotal = meta.total;
    if (typeof metaTotal === "number" || typeof metaTotal === "string") {
      return Number(metaTotal);
    }
  }

  return fallback;
}

export async function readJsonBody(res: Response): Promise<unknown> {
  return res.json() as Promise<unknown>;
}

export function unwrapEnvelopeData(body: unknown): unknown {
  return envelopeSchema.parse(body).data;
}

export function readDataEnvelope<T>(body: unknown, schema: z.ZodType<T>, context?: string): T {
  return parseWithSchema(unwrapEnvelopeData(body), schema, context);
}

export function readListEnvelope<T>(
  body: unknown,
  rowSchema: z.ZodType<T>,
  context?: string,
): { rows: T[]; total: number } {
  const envelope = envelopeSchema.parse(body);

  if (Array.isArray(envelope.data)) {
    const rows = envelope.data.map((row) => parseWithSchema(row, rowSchema, context));
    return { rows, total: readEnvelopeTotal(body, rows.length) };
  }

  if (isIndexableObject(envelope.data)) {
    const nested = envelope.data;
    const rows = Array.isArray(nested.rows)
      ? nested.rows.map((row) => parseWithSchema(row, rowSchema, context))
      : [];
    const nestedTotal = nested.total;
    const total =
      typeof nestedTotal === "number" || typeof nestedTotal === "string"
        ? Number(nestedTotal)
        : readEnvelopeTotal(body, rows.length);
    return { rows, total };
  }

  return { rows: [], total: 0 };
}

export function readNullableListEnvelope<T>(
  body: unknown,
  rowSchema: z.ZodType<T | null>,
  context?: string,
): { rows: T[]; total: number } {
  const envelope = envelopeSchema.parse(body);

  const parseRow = (row: unknown): T | null => {
    const result = rowSchema.safeParse(row);
    if (!result.success) {
      throw formatZodFailure(context, result.error);
    }
    return result.data;
  };

  const collectRows = (items: unknown[]): T[] =>
    items.map(parseRow).filter((row): row is T => row != null);

  if (Array.isArray(envelope.data)) {
    const rows = collectRows(envelope.data);
    return { rows, total: readEnvelopeTotal(body, rows.length) };
  }

  if (isIndexableObject(envelope.data)) {
    const nested = envelope.data;
    const rows = Array.isArray(nested.rows) ? collectRows(nested.rows) : [];
    const nestedTotal = nested.total;
    const total =
      typeof nestedTotal === "number" || typeof nestedTotal === "string"
        ? Number(nestedTotal)
        : readEnvelopeTotal(body, rows.length);
    return { rows, total };
  }

  return { rows: [], total: 0 };
}

type ReadDataOptions = EnvelopeParseContext & {
  notOkMessage?: NotOkMessage;
};

export async function readData<T>(
  res: Response,
  schema: z.ZodType<T>,
  options: ReadDataOptions = {},
): Promise<T> {
  if (!res.ok) {
    throw new HttpResponseError(resolveNotOkMessage(res.status, options.notOkMessage), res.status);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, schema, options.context);
}

export async function readList<T>(
  res: Response,
  rowSchema: z.ZodType<T>,
  options: ReadDataOptions = {},
): Promise<{ rows: T[]; total: number }> {
  if (!res.ok) {
    throw new HttpResponseError(resolveNotOkMessage(res.status, options.notOkMessage), res.status);
  }
  const body = await readJsonBody(res);
  return readListEnvelope(body, rowSchema, options.context);
}

type SafeReadDataOptions = EnvelopeParseContext & {
  nullStatuses?: number[];
  notOkMessage?: NotOkMessage;
};

export async function safeReadData<T>(
  res: Response,
  schema: z.ZodType<T>,
  options: SafeReadDataOptions = {},
): Promise<T | null> {
  const nullStatuses = options.nullStatuses ?? [404, 403];
  if (nullStatuses.includes(res.status)) return null;
  if (!res.ok) {
    throw new HttpResponseError(resolveNotOkMessage(res.status, options.notOkMessage), res.status);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, schema, options.context);
}
