export type AccessMarker =
  | { kind: "staff"; product: "bid" | "shop" }
  | { kind: "org_member"; legalEntityId: string };

export type TwoFactorPolicy =
  | { scope: "staff"; required: boolean }
  | { scope: "org"; legalEntityId: string; required: boolean };

export type TwoFactorPolicyRecord = TwoFactorPolicy & {
  setBySubjectId: string | null;
  setAt: Date;
};

export type TwoFactorPolicyScope = { scope: "staff" } | { scope: "org"; legalEntityId: string };

export type TwoFactorPolicyStore = {
  /** Access markers held by the subject plus the policies that apply to them. */
  readSubjectPolicyInputs(
    subjectId: string,
  ): Promise<{ markers: AccessMarker[]; policies: TwoFactorPolicy[] }>;
  readPolicy(scope: TwoFactorPolicyScope): Promise<TwoFactorPolicyRecord | null>;
  writePolicy(
    scope: TwoFactorPolicyScope,
    input: { required: boolean; setBySubjectId: string; at: Date },
  ): Promise<TwoFactorPolicyRecord>;
  /** Members covered by a scope and how many of them have two-step verification on. */
  countCoverage(scope: TwoFactorPolicyScope): Promise<{ members: number; enrolled: number }>;
  /** Subjects that exist mapped to whether they have two-step verification on. */
  readTwoFactorEnabled(subjectIds: readonly string[]): Promise<Map<string, boolean>>;
  /** Newest session start per subject, among the sessions Identity still holds. */
  readLastSignIn(subjectIds: readonly string[]): Promise<Map<string, Date>>;
};
