/** The browser's current sign-in record, as the issuer's session cookie names it. */
export type BrowserSession = { subjectId: string; sessionId: string };

export interface BrowserSignOutStore {
  /** The ids a record was known by before newer sign-ins in the same browser took it over. */
  earlierNames(sessionId: string, subjectId: string): Promise<string[]>;
  /**
   * Deletes the person's OAuth tokens that were issued under any of `names` (a record's id or one
   * of its earlier ids). Tokens issued under another sign-in, and other people's, stay.
   */
  deleteTokensIssuedUnder(subjectId: string, names: readonly string[]): Promise<number>;
}

export type SignInRevoker = {
  /** Marks the products' sessions for these ids ended and queues their back-channel sign-out. */
  revokeIdentitySessions(identitySessionIds: readonly string[]): Promise<unknown>;
};

/**
 * Signing out of a LAX product ends that browser's sign-in, not the person's every sign-in.
 *
 * The sign-in the browser holds (its record) has an id and may have earlier ids, because a newer
 * sign-in in the same browser took over an older one. An ID token a product holds can carry any of
 * them. Ending it means: every product signed in through the record or an earlier id is told by
 * back-channel logout, the record and its cookie go, and only the OAuth tokens issued under those
 * ids are deleted. The person's other browsers keep their records, tokens and refresh.
 */
export class BrowserSignOutService {
  constructor(
    private readonly store: BrowserSignOutStore,
    private readonly logout: SignInRevoker,
    /** Announces that an earlier id of the record ended (the record's own id is announced by the issuer's sign-out). */
    private readonly announceEnded: (userId: string, sessionId: string) => Promise<void>,
  ) {}

  /** The record's id first, then its earlier ids. Only this person's lineage ever resolves. */
  async namesOf(current: BrowserSession): Promise<string[]> {
    const earlier = await this.store.earlierNames(current.sessionId, current.subjectId);
    return [current.sessionId, ...earlier.filter((name) => name !== current.sessionId)];
  }

  /**
   * Whether an ID token's `sid` belongs to this browser's sign-in: the record itself or one of its
   * earlier ids. The caller has already checked the token belongs to the same person.
   */
  async isSignInOf(current: BrowserSession, sid: string): Promise<boolean> {
    return (await this.namesOf(current)).includes(sid);
  }

  /**
   * Ends the browser's sign-in. `endRecord` deletes the record and expires its cookie (the
   * issuer's own sign-out) and returns its response, which is returned unchanged.
   *
   * Products are told first, so a record that fails to end leaves the person signed out of the
   * products and still signed in at the issuer, never the reverse. Tokens go only once the record
   * has: until then the person is still signed in.
   */
  async end(current: BrowserSession, endRecord: () => Promise<Response>): Promise<Response> {
    const names = await this.namesOf(current);
    await this.logout.revokeIdentitySessions(names);
    const response = await endRecord();
    if (!response.ok) return response;
    await this.store.deleteTokensIssuedUnder(current.subjectId, names);
    await Promise.all(
      names.slice(1).map((sessionId) => this.announceEnded(current.subjectId, sessionId)),
    );
    return response;
  }
}
