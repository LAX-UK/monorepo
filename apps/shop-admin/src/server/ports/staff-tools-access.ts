/** A staff tool a person can switch to, named as the staff kit names it. */
export type StaffToolId = "bid-admin" | "lax-admin";

export type StaffToolsAnswer =
  | { status: "ok"; tools: readonly StaffToolId[] }
  /** The answer could not be had. Callers treat it as "no other tools", never as "all tools". */
  | { status: "unavailable" };

/** The signed-in person, as the session holds them. */
export type StaffToolsCaller = {
  subjectId: string;
  /** The session's ID token; exchanged for a token the Bid API accepts. */
  idToken: string;
};

/** Which staff tools the signed-in person can open, asked of the Bid API on their behalf. */
export type StaffToolsAccess = {
  toolsFor(caller: StaffToolsCaller): Promise<StaffToolsAnswer>;
};
