import { CONFIRM_LINK_TTL_MS, type SubscriberRecord } from "../domain/subscriber.js";
import type { AlertLinkCodec } from "../links/codec.js";
import type { AlertUrls, ConfirmationMessage } from "../ports.js";

/** The confirmation email for a pending subscriber, with its links signed. */
export function confirmationMessage(
  record: SubscriberRecord,
  codec: AlertLinkCodec,
  urls: AlertUrls,
): ConfirmationMessage {
  const requestedAtMs = record.requestedAt.getTime();
  const base = {
    product: record.product,
    subscriberId: record.id,
    linkVersion: record.linkVersion,
  };
  const stopToken = codec.create({ kind: "stop", ...base });
  return {
    product: record.product,
    to: record.email,
    subscriberId: record.id,
    requestedAtMs,
    confirmUrl: urls.confirm(codec.create({ kind: "confirm", requestedAtMs, ...base })),
    stopUrl: urls.stop(stopToken),
    oneClickUrl: urls.oneClick(stopToken),
    expirationHours: CONFIRM_LINK_TTL_MS / 3_600_000,
  };
}

export function stopLinks(record: SubscriberRecord, codec: AlertLinkCodec, urls: AlertUrls) {
  const token = codec.create({
    kind: "stop",
    product: record.product,
    subscriberId: record.id,
    linkVersion: record.linkVersion,
  });
  return { stopUrl: urls.stop(token), oneClickUrl: urls.oneClick(token) };
}
