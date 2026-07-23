import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { AdminComplianceRoutesContainer } from "../interfaces/admin-routes/admin-route-container-slices.js";
import type {
  SubmissionAdminRoutesContainer,
  SubmissionDocumentRoutesContainer,
  SubmissionRoutesContainer,
} from "../interfaces/submission-routes/submission-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _SubmissionRoutesFromContainer = AssertAssignable<Container, SubmissionRoutesContainer>;
type _SubmissionAdminFromContainer = AssertAssignable<Container, SubmissionAdminRoutesContainer>;
type _SubmissionDocumentsFromContainer = AssertAssignable<
  Container,
  SubmissionDocumentRoutesContainer
>;
type _SubmissionMustNotSeeComplianceAdmin = AssertNotAssignable<
  SubmissionRoutesContainer,
  AdminComplianceRoutesContainer
>;

type _SubmissionSliceContract = [
  _SubmissionRoutesFromContainer,
  _SubmissionAdminFromContainer,
  _SubmissionDocumentsFromContainer,
  _SubmissionMustNotSeeComplianceAdmin,
];

defineCompileTimeContract<_SubmissionSliceContract>();

describe("submission route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
