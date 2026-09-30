import type {
  ILotTransitionGuardReader,
  ILotTransitionRepository,
} from "@auction/persistence/interfaces";
import type {
  DrizzleLotTransitionGuardReader,
  DrizzleLotTransitionRepository,
} from "@auction/persistence/repositories";
import type { LotTransitionOrchestrator } from "../services/lot-transition-orchestrator.js";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";

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
