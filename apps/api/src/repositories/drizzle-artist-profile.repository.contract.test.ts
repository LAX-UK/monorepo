import type {
  IArtistProfileAdminReader,
  IArtistProfileCommandRepository,
  IArtistProfileDirectoryReader,
} from "@auction/persistence/interfaces";
import type { IArtistDeleteGuards, IArtistDeleteRepository } from "@auction/persistence/interfaces";
import type { DrizzleArtistProfileRepository } from "@auction/persistence/repositories";
import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: DrizzleArtistProfileRepository;
declare const directory: IArtistProfileDirectoryReader;
declare const admin: IArtistProfileAdminReader;
declare const commands: IArtistProfileCommandRepository;

type _FacadeDirectory = AssertAssignable<typeof facade, IArtistProfileDirectoryReader>;
type _FacadeAdmin = AssertAssignable<typeof facade, IArtistProfileAdminReader>;
type _FacadeCommands = AssertAssignable<typeof facade, IArtistProfileCommandRepository>;
type _FacadeDeleteGuards = AssertAssignable<typeof facade, IArtistDeleteGuards>;
type _FacadeDeleteRepo = AssertAssignable<typeof facade, IArtistDeleteRepository>;
type _SplitReaders = [typeof directory, typeof admin, typeof commands];

type _ArtistProfileContract = [
  _FacadeDirectory,
  _FacadeAdmin,
  _FacadeCommands,
  _FacadeDeleteGuards,
  _FacadeDeleteRepo,
  _SplitReaders,
];

defineCompileTimeContract<_ArtistProfileContract>();

describe("DrizzleArtistProfileRepository facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
