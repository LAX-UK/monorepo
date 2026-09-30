import {
  type AssertAssignable,
  defineCompileTimeContract,
} from "../testing/compile-time-contract.js";
import type { ProjectorRegistry, createDefaultProjectorRegistry } from "./projector-registry.js";

type _RegistryContract = AssertAssignable<
  ReturnType<typeof createDefaultProjectorRegistry>,
  ProjectorRegistry
>;
defineCompileTimeContract<_RegistryContract>();
