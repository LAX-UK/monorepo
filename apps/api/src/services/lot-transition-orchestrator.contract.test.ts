import type {
  ILotTransitionGuardReader,
  ILotTransitionRepository,
} from "@auction/persistence/interfaces";
import type {
  DrizzleLotTransitionGuardReader,
  DrizzleLotTransitionRepository,
} from "@auction/persistence/repositories";
import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { LotTransitionOrchestrator } from "./lot-transition-orchestrator.js";

type AssertAssignable<T extends U, U> = T;

declare const orchestrator: LotTransitionOrchestrator;
declare const guardReader: DrizzleLotTransitionGuardReader;
declare const transitionRepo: DrizzleLotTransitionRepository;

type _GuardReader = AssertAssignable<typeof guardReader, ILotTransitionGuardReader>;
type _TransitionRepo = AssertAssignable<typeof transitionRepo, ILotTransitionRepository>;
type _OrchestratorHasReturn = AssertAssignable<
  typeof orchestrator,
  { returnToInventory: LotTransitionOrchestrator["returnToInventory"] }
>;

type _LotTransitionContract = [_GuardReader, _TransitionRepo, _OrchestratorHasReturn];

defineCompileTimeContract<_LotTransitionContract>();

describe("Lot transition orchestrator contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
