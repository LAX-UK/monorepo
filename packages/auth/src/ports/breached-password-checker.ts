export type BreachedPasswordCheckResult =
  | { status: "clear" }
  | { status: "breached" }
  | { status: "unknown" };

export type BreachedPasswordChecker = {
  checkPassword(password: string): Promise<BreachedPasswordCheckResult>;
};
