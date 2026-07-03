import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { ArtistRegistryService } from "./artist-registry.service.js";
import type {
  IArtistRegistryQueryService,
  IArtistRegistryService,
  IArtistRegistryStaffCommandService,
} from "./interfaces/artist-registry.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: ArtistRegistryService;

type _Composite = AssertAssignable<typeof facade, IArtistRegistryService>;
type _Query = AssertAssignable<typeof facade, IArtistRegistryQueryService>;
type _StaffCommand = AssertAssignable<typeof facade, IArtistRegistryStaffCommandService>;

type _FacadeContract = [_Composite, _Query, _StaffCommand];

defineCompileTimeContract<_FacadeContract>();

describe("ArtistRegistryService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
