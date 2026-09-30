import type {
  ILegalEntityMembershipReader,
  ILegalEntityReader,
  ILegalEntityRepository,
} from "@auction/persistence/interfaces";
import type { DrizzleLegalEntityRepository } from "@auction/persistence/repositories";
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
