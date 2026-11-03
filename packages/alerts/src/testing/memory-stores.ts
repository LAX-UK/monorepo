import type { NewMatch, PendingMatch } from "../domain/match.js";
import type { AlertProduct, AlertTopic } from "../domain/products.js";
import type { StopReason, SubscriberRecord, TopicChangedBy } from "../domain/subscriber.js";
import type {
  AnnouncementStore,
  DigestClaim,
  DigestLedger,
  MatchLedger,
  SubscriberStore,
  TopicRecipient,
  TopicStore,
  TopicSwitch,
  UnsentDigest,
} from "../ports.js";

/** All the engine's stores in memory: the reference the Postgres adapters must agree with. */
export class MemoryAlertStores
  implements SubscriberStore, TopicStore, MatchLedger, DigestLedger, AnnouncementStore
{
  private seq = 0;
  readonly subscribersById = new Map<string, SubscriberRecord & { stopReason?: StopReason }>();
  private readonly topicRows = new Map<string, Map<AlertTopic, boolean>>();
  private readonly matchRows = new Map<
    string,
    PendingMatch & { digestId: string | null; dropped: string | null }
  >();
  private readonly digestRows = new Map<
    string,
    {
      id: string;
      subscriberId: string;
      product: AlertProduct;
      localDate: string;
      key: string;
      sent: boolean;
    }
  >();
  private readonly announcements = new Map<string, { announce: boolean; expanded: boolean }>();

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${String(this.seq).padStart(6, "0")}`;
  }

  async findByEmail(product: AlertProduct, email: string) {
    return (
      [...this.subscribersById.values()].find((s) => s.product === product && s.email === email) ??
      null
    );
  }

  async findById(id: string) {
    return this.subscribersById.get(id) ?? null;
  }

  async findBySubject(product: AlertProduct, subjectId: string) {
    return (
      [...this.subscribersById.values()].find(
        (s) => s.product === product && s.subjectId === subjectId,
      ) ?? null
    );
  }

  async savePending(input: {
    product: AlertProduct;
    email: string;
    consentText: string;
    consentSource: string;
    now: Date;
  }) {
    const existing = await this.findByEmail(input.product, input.email);
    if (existing?.status === "confirmed") return existing;
    const record: SubscriberRecord = {
      id: existing?.id ?? this.nextId("sub"),
      product: input.product,
      email: input.email,
      subjectId: existing?.subjectId ?? null,
      status: "pending",
      requestedAt: input.now,
      confirmationSentAt: input.now,
      linkVersion: existing?.linkVersion ?? 1,
    };
    this.subscribersById.set(record.id, record);
    return record;
  }

  async saveConfirmedForAccount(input: {
    product: AlertProduct;
    email: string;
    subjectId: string;
    consentText: string;
    consentSource: string;
    now: Date;
  }) {
    const existing = await this.findByEmail(input.product, input.email);
    // An address that complained stays stopped until a person at LAX lifts it.
    if (existing?.stopReason === "complaint") return existing;
    const record: SubscriberRecord = {
      id: existing?.id ?? this.nextId("sub"),
      product: input.product,
      email: input.email,
      subjectId: input.subjectId,
      status: "confirmed",
      requestedAt: existing?.requestedAt ?? input.now,
      confirmationSentAt: existing?.confirmationSentAt ?? null,
      linkVersion: existing?.linkVersion ?? 1,
    };
    this.subscribersById.set(record.id, record);
    return record;
  }

  async confirm(id: string, _now: Date) {
    const row = this.subscribersById.get(id);
    if (!row || row.status !== "pending") return false;
    this.subscribersById.set(id, { ...row, status: "confirmed" });
    return true;
  }

  async stop(id: string, reason: StopReason, _now: Date) {
    const row = this.subscribersById.get(id);
    if (!row || row.status === "stopped") return false;
    this.subscribersById.set(id, { ...row, status: "stopped", stopReason: reason });
    return true;
  }

  async linkAccount(id: string, subjectId: string, _now: Date) {
    const row = this.subscribersById.get(id);
    if (row) this.subscribersById.set(id, { ...row, subjectId });
  }

  async list(subscriberId: string): Promise<TopicSwitch[]> {
    return [...(this.topicRows.get(subscriberId) ?? new Map()).entries()].map(
      ([topic, emailOn]) => ({ topic, emailOn }),
    );
  }

  async setEmail(
    subscriberId: string,
    topic: AlertTopic,
    on: boolean,
    _by: TopicChangedBy,
    _now: Date,
  ) {
    const rows = this.topicRows.get(subscriberId) ?? new Map<AlertTopic, boolean>();
    rows.set(topic, on);
    this.topicRows.set(subscriberId, rows);
  }

  async listEmailRecipients(
    topic: AlertTopic,
    after: string | null,
    limit: number,
  ): Promise<TopicRecipient[]> {
    return [...this.subscribersById.values()]
      .filter((s) => s.status === "confirmed" && this.topicRows.get(s.id)?.get(topic) === true)
      .map((s) => ({ subscriberId: s.id }))
      .filter((r) => after === null || r.subscriberId > after)
      .sort((a, b) => a.subscriberId.localeCompare(b.subscriberId))
      .slice(0, limit);
  }

  async record(matches: readonly NewMatch[]) {
    let added = 0;
    for (const m of matches) {
      const clash = [...this.matchRows.values()].some(
        (r) => r.subscriberId === m.subscriberId && r.topic === m.topic && r.itemKey === m.itemKey,
      );
      if (clash) continue;
      const id = this.nextId("match");
      this.matchRows.set(id, { ...m, id, digestId: null, dropped: null });
      added += 1;
    }
    return added;
  }

  private pendingRows() {
    return [...this.matchRows.values()].filter((r) => r.digestId === null && r.dropped === null);
  }

  async pendingSubscribers(product: AlertProduct, after: string | null, limit: number) {
    const ids = new Set(
      this.pendingRows()
        .filter((r) => this.subscribersById.get(r.subscriberId)?.product === product)
        .map((r) => r.subscriberId),
    );
    return [...ids]
      .filter((id) => after === null || id > after)
      .sort()
      .slice(0, limit);
  }

  async pendingFor(subscriberId: string): Promise<PendingMatch[]> {
    return this.pendingRows()
      .filter((r) => r.subscriberId === subscriberId)
      .map(({ digestId: _d, dropped: _x, ...match }) => match);
  }

  async drop(matchIds: readonly string[], reason: string, _now: Date) {
    for (const id of matchIds) {
      const row = this.matchRows.get(id);
      if (row) this.matchRows.set(id, { ...row, dropped: reason });
    }
  }

  async claimItem(itemKey: string, announce: boolean, _now: Date) {
    const existing = this.announcements.get(itemKey);
    if (existing) return { first: false, announce: existing.announce, expanded: existing.expanded };
    this.announcements.set(itemKey, { announce, expanded: false });
    return { first: true, announce, expanded: false };
  }

  async claim(a: DigestClaim): Promise<{ digestId: string } | null> {
    const clash = [...this.digestRows.values()].some(
      (d) =>
        d.subscriberId === a.subscriberId && d.product === a.product && d.localDate === a.localDate,
    );
    if (clash) return null;
    const id = this.nextId("digest");
    this.digestRows.set(id, {
      id,
      subscriberId: a.subscriberId,
      product: a.product,
      localDate: a.localDate,
      key: a.idempotencyKey,
      sent: false,
    });
    for (const matchId of a.matchIds) {
      const row = this.matchRows.get(matchId);
      if (row) this.matchRows.set(matchId, { ...row, digestId: id });
    }
    return { digestId: id };
  }

  async matchesOf(digestId: string): Promise<PendingMatch[]> {
    return [...this.matchRows.values()]
      .filter((r) => r.digestId === digestId)
      .map(({ digestId: _d, dropped: _x, ...match }) => match);
  }

  async unsent(product: AlertProduct, localDate: string, limit: number): Promise<UnsentDigest[]> {
    return [...this.digestRows.values()]
      .filter((d) => d.product === product && d.localDate === localDate && !d.sent)
      .slice(0, limit)
      .map((d) => ({ digestId: d.id, subscriberId: d.subscriberId, idempotencyKey: d.key }));
  }

  async markSent(digestId: string, _now: Date) {
    const row = this.digestRows.get(digestId);
    if (row) this.digestRows.set(digestId, { ...row, sent: true });
  }

  async markExpanded(itemKey: string, _now: Date) {
    const row = this.announcements.get(itemKey);
    if (row) this.announcements.set(itemKey, { ...row, expanded: true });
  }
}
