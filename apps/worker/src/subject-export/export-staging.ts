import { once } from "node:events";
import { type WriteStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

/** One file waiting on local disk to go into the ZIP. */
export type StagedEntry = {
  /** Path inside the ZIP, from the top folder. */
  zipPath: string;
  diskPath: string;
  bytes: number;
  /** JSON data compresses well; uploaded files (PDF, JPEG) are already compressed. */
  compress: boolean;
};

/** The header of every JSON data file; the records follow it. */
export type JsonEnvelopeHeader = {
  schema: string;
  product: string;
  controller: string;
  generatedAt: string;
};

/**
 * Writes one data file as `{ ...header, "records": [ ... ] }`, a record at a time, so a large
 * category never sits in memory. An empty category is still a file with `"records": []`.
 */
export class JsonRecordsWriter {
  private count = 0;
  private bytes = 0;

  private constructor(
    private readonly stream: WriteStream,
    private readonly entry: Omit<StagedEntry, "bytes">,
  ) {}

  static async open(
    entry: Omit<StagedEntry, "bytes">,
    header: JsonEnvelopeHeader,
  ): Promise<JsonRecordsWriter> {
    const writer = new JsonRecordsWriter(createWriteStream(entry.diskPath), entry);
    const head = JSON.stringify(header, null, 2).replace(/\n}$/, ',\n  "records": [');
    await writer.write(head);
    return writer;
  }

  async append(record: unknown): Promise<void> {
    const body = JSON.stringify(record, null, 2).replace(/\n/g, "\n    ");
    await this.write(`${this.count === 0 ? "\n    " : ",\n    "}${body}`);
    this.count += 1;
  }

  get recordCount(): number {
    return this.count;
  }

  async close(): Promise<StagedEntry & { records: number }> {
    await this.write(this.count === 0 ? "]\n}\n" : "\n  ]\n}\n");
    await new Promise<void>((resolve, reject) => {
      this.stream.once("error", reject);
      this.stream.end(resolve);
    });
    return { ...this.entry, bytes: this.bytes, records: this.count };
  }

  /** Abandons the file after an error; the staging directory is removed by its owner. */
  abort(): void {
    this.stream.destroy();
  }

  private async write(text: string): Promise<void> {
    this.bytes += Buffer.byteLength(text);
    if (!this.stream.write(text)) await once(this.stream, "drain");
  }
}

/**
 * The directory on local disk where one copy is gathered before it is zipped. Paths inside the ZIP
 * are unique by construction, and the whole directory goes in a `finally`.
 */
export class ExportStaging {
  readonly entries: StagedEntry[] = [];
  private readonly zipPaths = new Set<string>();
  private sequence = 0;

  constructor(readonly directory: string) {}

  /** A path in the ZIP that no other entry has: a number is added before the extension on a clash. */
  claimZipPath(wanted: string): string {
    let candidate = wanted;
    for (let n = 2; this.zipPaths.has(candidate); n += 1) {
      const dot = wanted.lastIndexOf(".");
      const slash = wanted.lastIndexOf("/");
      candidate =
        dot > slash + 1 ? `${wanted.slice(0, dot)}-${n}${wanted.slice(dot)}` : `${wanted}-${n}`;
    }
    this.zipPaths.add(candidate);
    return candidate;
  }

  /** A fresh file name on disk, kept apart from the ZIP path so names never need sanitising twice. */
  newDiskPath(): string {
    this.sequence += 1;
    return join(this.directory, `part-${this.sequence}`);
  }

  async openJson(zipPath: string, header: JsonEnvelopeHeader): Promise<JsonRecordsWriter> {
    return JsonRecordsWriter.open(
      { zipPath: this.claimZipPath(zipPath), diskPath: this.newDiskPath(), compress: true },
      header,
    );
  }

  add(entry: StagedEntry): void {
    this.entries.push(entry);
  }

  async remove(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }

  static async create(directory: string): Promise<ExportStaging> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    return new ExportStaging(directory);
  }
}
