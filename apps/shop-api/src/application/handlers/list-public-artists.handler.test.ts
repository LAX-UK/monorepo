import { describe, expect, it } from "vitest";
import { encodeCatalogueCursor, encodeNameCursor } from "../catalogue-cursor.js";
import type {
  ArtistDirectoryReader,
  ListPublicArtistsInput,
} from "../ports/artist-directory.reader.js";
import { createListPublicArtistsHandler } from "./list-public-artists.handler.js";

function recordingReader() {
  const inputs: ListPublicArtistsInput[] = [];
  const reader: ArtistDirectoryReader = {
    async listPublicArtists(input) {
      inputs.push(input);
      return { items: [] };
    },
    async getPublicArtistBySlug() {
      return null;
    },
  };
  return { reader, inputs };
}

describe("createListPublicArtistsHandler", () => {
  it("normalises letter and forwards sort and sales channel", async () => {
    const { reader, inputs } = recordingReader();
    await createListPublicArtistsHandler(reader)({
      limit: 50,
      letter: " f ",
      sort: "nameAsc",
      salesChannel: "art",
      q: "  ",
    });
    expect(inputs).toEqual([{ limit: 50, letter: "F", sort: "nameAsc", salesChannel: "art" }]);
  });

  it("drops non-alphabetic letters", async () => {
    const { reader, inputs } = recordingReader();
    await createListPublicArtistsHandler(reader)({ limit: 20, letter: "1" });
    expect(inputs).toEqual([{ limit: 20 }]);
  });

  it("reads a name cursor for the name sorts and a date cursor otherwise", async () => {
    const { reader, inputs } = recordingReader();
    const handler = createListPublicArtistsHandler(reader);
    await handler({
      limit: 24,
      sort: "nameAsc",
      cursor: encodeNameCursor({ name: "Juno Frost", id: "a-1" }),
    });
    const createdAt = new Date("2026-09-15T12:00:00.000Z");
    await handler({ limit: 24, cursor: encodeCatalogueCursor({ createdAt, id: "a-2" }) });
    expect(inputs).toEqual([
      { limit: 24, sort: "nameAsc", nameCursor: { name: "Juno Frost", id: "a-1" } },
      { limit: 24, cursor: { createdAt, id: "a-2" } },
    ]);
  });
});
