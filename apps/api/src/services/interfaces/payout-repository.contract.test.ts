import type { IPayoutAnalyticsRepository, IPayoutLifecycleRepository, IPayoutReadRepository, IPayoutRepository, IPayoutWriteRepository } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";

type AssertAssignable<T extends U, U> = T;

type PayoutRepositoryPorts = IPayoutReadRepository &
  IPayoutWriteRepository &
  IPayoutLifecycleRepository &
  IPayoutAnalyticsRepository;

declare const payoutRepo: IPayoutRepository;

type _CompositeExtendsIntersection = AssertAssignable<IPayoutRepository, PayoutRepositoryPorts>;
type _IntersectionExtendsComposite = AssertAssignable<PayoutRepositoryPorts, IPayoutRepository>;
type _ReadPort = AssertAssignable<typeof payoutRepo, IPayoutReadRepository>;
type _WritePort = AssertAssignable<typeof payoutRepo, IPayoutWriteRepository>;
type _LifecyclePort = AssertAssignable<typeof payoutRepo, IPayoutLifecycleRepository>;
type _AnalyticsPort = AssertAssignable<typeof payoutRepo, IPayoutAnalyticsRepository>;

type _PayoutRepositoryIspContract = [
  _CompositeExtendsIntersection,
  _IntersectionExtendsComposite,
  _ReadPort,
  _WritePort,
  _LifecyclePort,
  _AnalyticsPort,
];

defineCompileTimeContract<_PayoutRepositoryIspContract>();

describe("IPayoutRepository ISP contract", () => {
  it("composite intersection includes all segregated port methods", () => {
    expect(true).toBe(true);
  });
});
