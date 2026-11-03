import { SUBJECT_EXPORT_MAX_ARCHIVE_BYTES } from "@auction/identity-contracts";
import { permanentError } from "./subject-export.errors.js";

/** Room kept for the README, summary, manifest and the data files still to come. */
export const ARCHIVE_RESERVE_BYTES = 64 * 1024 * 1024;

/**
 * Tracks how much of the copy's size cap is spent. Data files always go in, since leaving them
 * out would be a partial copy; if they alone pass the cap the request cannot be met by this
 * route. Uploaded files go in while they fit with the reserve to spare, and the rest are listed
 * as "ask us". The cap counts uncompressed content, which is the safe side of the compressed size.
 */
export class ArchiveBudget {
  private spent = 0;

  constructor(
    private readonly cap = SUBJECT_EXPORT_MAX_ARCHIVE_BYTES,
    private readonly reserve = ARCHIVE_RESERVE_BYTES,
  ) {}

  get usedBytes(): number {
    return this.spent;
  }

  /** The most an uploaded file may be right now. */
  get roomForFileBytes(): number {
    return Math.max(0, this.cap - this.reserve - this.spent);
  }

  fitsFile(bytes: number): boolean {
    return bytes <= this.roomForFileBytes;
  }

  admitFile(bytes: number): boolean {
    if (!this.fitsFile(bytes)) return false;
    this.spent += bytes;
    return true;
  }

  admitData(bytes: number): void {
    this.spent += bytes;
    if (this.spent > this.cap) throw permanentError("export_too_large");
  }
}
