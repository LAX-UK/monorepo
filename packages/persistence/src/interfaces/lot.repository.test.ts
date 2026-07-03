import { describe, expect, it } from "vitest";
import type {
  ILotAnalyticsRepository,
  ILotLifecycleRepository,
  ILotReadRepository,
  ILotRepository,
  ILotWriteRepository,
} from "./lot.repository.js";

/** Forces T to be resolved during typecheck (no runtime effect). */
function defineCompileTimeContract<T>(): void {
  void (undefined as unknown as T);
}

type AssertAssignable<T extends U, U> = T;

type LotRepositoryPorts = ILotReadRepository &
  ILotWriteRepository &
  ILotLifecycleRepository &
  ILotAnalyticsRepository;

declare const lotRepo: ILotRepository;

type _CompositeExtendsIntersection = AssertAssignable<ILotRepository, LotRepositoryPorts>;
type _IntersectionExtendsComposite = AssertAssignable<LotRepositoryPorts, ILotRepository>;
type _ReadPort = AssertAssignable<typeof lotRepo, ILotReadRepository>;
type _WritePort = AssertAssignable<typeof lotRepo, ILotWriteRepository>;
type _LifecyclePort = AssertAssignable<typeof lotRepo, ILotLifecycleRepository>;
type _AnalyticsPort = AssertAssignable<typeof lotRepo, ILotAnalyticsRepository>;

type _LotRepositoryIspContract = [
  _CompositeExtendsIntersection,
  _IntersectionExtendsComposite,
  _ReadPort,
  _WritePort,
  _LifecyclePort,
  _AnalyticsPort,
];

defineCompileTimeContract<_LotRepositoryIspContract>();

describe("ILotRepository ISP contract", () => {
  it("composite intersection includes all segregated port methods", () => {
    expect(true).toBe(true);
  });
});
