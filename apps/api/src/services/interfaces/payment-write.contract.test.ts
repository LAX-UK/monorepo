import type { IPaymentAnalyticsRepository, IPaymentLifecycleRepository, IPaymentMutationRepository, IPaymentReadRepository, IPaymentWriteRepository } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";

type AssertAssignable<T extends U, U> = T;

type PaymentRepositoryPorts = IPaymentReadRepository &
  IPaymentMutationRepository &
  IPaymentLifecycleRepository &
  IPaymentAnalyticsRepository;

declare const paymentRepo: IPaymentWriteRepository;

type _CompositeExtendsIntersection = AssertAssignable<
  IPaymentWriteRepository,
  PaymentRepositoryPorts
>;
type _IntersectionExtendsComposite = AssertAssignable<
  PaymentRepositoryPorts,
  IPaymentWriteRepository
>;
type _ReadPort = AssertAssignable<typeof paymentRepo, IPaymentReadRepository>;
type _MutationPort = AssertAssignable<typeof paymentRepo, IPaymentMutationRepository>;
type _LifecyclePort = AssertAssignable<typeof paymentRepo, IPaymentLifecycleRepository>;
type _AnalyticsPort = AssertAssignable<typeof paymentRepo, IPaymentAnalyticsRepository>;

type _PaymentRepositoryIspContract = [
  _CompositeExtendsIntersection,
  _IntersectionExtendsComposite,
  _ReadPort,
  _MutationPort,
  _LifecyclePort,
  _AnalyticsPort,
];

defineCompileTimeContract<_PaymentRepositoryIspContract>();

describe("IPaymentWriteRepository ISP contract", () => {
  it("composite intersection includes all segregated port methods", () => {
    expect(true).toBe(true);
  });
});
