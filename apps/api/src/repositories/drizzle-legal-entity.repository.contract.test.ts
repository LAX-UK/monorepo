import type { ILegalEntityMembershipReader, ILegalEntityReader, ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { DrizzleLegalEntityRepository } from "@auction/persistence/repositories";
import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: DrizzleLegalEntityRepository;
declare const entityReader: ILegalEntityReader;
declare const membershipReader: ILegalEntityMembershipReader;

type _Facade = AssertAssignable<typeof facade, ILegalEntityRepository>;
type _EntityReader = AssertAssignable<
  typeof entityReader,
  Pick<ILegalEntityRepository, keyof ILegalEntityReader>
>;
type _MembershipReader = AssertAssignable<
  typeof membershipReader,
  Pick<ILegalEntityRepository, keyof ILegalEntityMembershipReader>
>;

type _LegalEntityContract = [_Facade, _EntityReader, _MembershipReader];

defineCompileTimeContract<_LegalEntityContract>();

describe("DrizzleLegalEntityRepository facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
