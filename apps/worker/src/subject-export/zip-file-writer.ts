import { type Hash, createHash } from "node:crypto";
import { once } from "node:events";
import { type WriteStream, createReadStream, createWriteStream } from "node:fs";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

/** The size and checksum of something put into the ZIP, as it was before compression. */
export type ArchivedPart = { path: string; bytes: number; sha256: string };

/**
 * Writes a ZIP to local disk one entry at a time, in constant memory. Each entry's own SHA-256 is
 * taken as its bytes pass through, and the finished ZIP's size and SHA-256 as it is written, so
 * nothing is read twice. Entries sit under one top folder, as the design lays the copy out.
 *
 * Sizes stay under 4 GB (the copy is capped at 2 GB), so the plain ZIP format is enough.
 */
export class ZipFileWriter {
  private readonly zip: Zip;
  private readonly outputHash: Hash = createHash("sha256");
  private outputBytes = 0;
  private failure: Error | null = null;
  private drainNeeded = false;

  private constructor(
    private readonly out: WriteStream,
    private readonly root: string,
    private readonly modifiedAt: Date,
  ) {
    this.zip = new Zip((error, chunk) => {
      if (error) {
        this.failure = error;
        return;
      }
      this.outputHash.update(chunk);
      this.outputBytes += chunk.length;
      if (!this.out.write(chunk)) this.drainNeeded = true;
    });
  }

  static open(path: string, root: string, modifiedAt: Date): ZipFileWriter {
    return new ZipFileWriter(createWriteStream(path), root, modifiedAt);
  }

  async addBuffer(path: string, body: Buffer, compress: boolean): Promise<ArchivedPart> {
    const entry = this.entry(path, compress);
    const hash = createHash("sha256").update(body);
    entry.push(body, true);
    await this.settle();
    return { path, bytes: body.length, sha256: hash.digest("hex") };
  }

  async addFile(path: string, diskPath: string, compress: boolean): Promise<ArchivedPart> {
    const entry = this.entry(path, compress);
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of createReadStream(diskPath)) {
      const buffer = chunk as Buffer;
      hash.update(buffer);
      bytes += buffer.length;
      entry.push(buffer, false);
      await this.settle();
    }
    entry.push(new Uint8Array(0), true);
    await this.settle();
    return { path, bytes, sha256: hash.digest("hex") };
  }

  async finish(): Promise<{ bytes: number; sha256: string }> {
    this.zip.end();
    await this.settle();
    await new Promise<void>((resolve, reject) => {
      this.out.once("error", reject);
      this.out.end(resolve);
    });
    return { bytes: this.outputBytes, sha256: this.outputHash.digest("hex") };
  }

  /** Closes the file after an error; the directory it sits in is removed by its owner. */
  abort(): void {
    this.out.destroy();
  }

  private entry(path: string, compress: boolean): ZipDeflate | ZipPassThrough {
    const name = `${this.root}/${path}`;
    const entry = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
    entry.mtime = this.modifiedAt;
    this.zip.add(entry);
    return entry;
  }

  private async settle(): Promise<void> {
    if (this.failure) throw this.failure;
    if (this.drainNeeded) {
      this.drainNeeded = false;
      await once(this.out, "drain");
    }
  }
}
