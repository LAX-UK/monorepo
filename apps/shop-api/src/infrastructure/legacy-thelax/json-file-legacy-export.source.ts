import { readFile } from "node:fs/promises";
import type { LegacyThelaxExportSource } from "../../application/ports/legacy-thelax-import.ports.js";

export function createJsonFileLegacyExportSource(path: string): LegacyThelaxExportSource {
  return {
    async read() {
      return JSON.parse(await readFile(path, "utf8")) as unknown;
    },
  };
}
