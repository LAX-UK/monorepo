import {
  type TwoFactorPolicyStore,
  type TwoFactorRequirement,
  resolveTwoFactorRequirement,
} from "@auction/auth";

export type TwoFactorRequirementReader = (subjectId: string) => Promise<TwoFactorRequirement>;

export function createTwoFactorRequirementReader(
  store: Pick<TwoFactorPolicyStore, "readSubjectPolicyInputs">,
): TwoFactorRequirementReader {
  return async (subjectId) =>
    resolveTwoFactorRequirement(await store.readSubjectPolicyInputs(subjectId));
}
