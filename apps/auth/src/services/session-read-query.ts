/**
 * The query for reading who a request's session cookie signs in, when the read only identifies
 * them. It keeps Better Auth from renewing the record as a side effect of the read.
 *
 * A record whose `expires_at` is held under a week (every staff record, whose idle limit is 12
 * hours) is renewed by every read, because Better Auth renews whenever less than six days remain.
 * A renewal rewrites the record and sets a new session cookie on the response, and in a request
 * that carries the hosted page's `oidc_login_prompt` cookie the OIDC provider's after-hook takes
 * that as a sign-in to continue into an authorization with no request to answer ("request not
 * found"). Use is noted by `SessionActivity`, which moves `expires_at` within the person's limits.
 *
 * Better Auth reads `disableRefresh` from the query at run time (its session route returns before
 * renewing) but leaves it out of the endpoint's query type, hence the type given here.
 */
export const IDENTIFY_ONLY = { disableRefresh: true } as unknown as {
  disableCookieCache?: boolean;
};
