import { describe, expect, it } from "vitest";
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
});
