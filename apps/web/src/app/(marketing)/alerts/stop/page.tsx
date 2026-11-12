import { StopAlertLink } from "@/components/alerts/alert-link-client";
import { readAlertLink } from "@/lib/data/http/alerts.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { TOPIC_CATALOGUE, isAlertTopic } from "@auction/alerts/topics";
import { ALERT_LINK_COPY } from "@auction/marketing-ui/alerts/alert-link-copy";
import { EmptyState } from "@auction/ui/lax/empty-state";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Stop sale alerts",
  "Stop LAX Bid alert emails.",
);

/** The topic as the page names it: in a list ("saved searches") or as a modifier ("saved search"). */
const named = (topic: string, kind: "listName" | "shortName") => ({
  id: topic,
  label: isAlertTopic(topic) ? TOPIC_CATALOGUE[topic][kind] : topic,
});

/** Opening the stop link only reads it; the button stops the emails. */
export default async function StopAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const preview = token ? await readAlertLink("stop", token) : { state: "invalid" as const };
  if (!preview) {
    return (
      <EmptyState
        layout="page"
        variant="error"
        className="pt-[var(--header-height)]"
        illustration="askew"
        title={ALERT_LINK_COPY.bid.stop.failedTitle}
        description="Open the link in your email again in a moment."
      />
    );
  }
  if (preview.state === "ready") {
    return (
      <StopAlertLink
        token={token}
        link={{
          state: "ready",
          maskedEmail: preview.maskedEmail,
          topics: preview.topics.map((t) => named(t, "listName")),
          fromTopic: preview.fromTopic ? named(preview.fromTopic, "shortName") : null,
        }}
      />
    );
  }
  return <StopAlertLink token={token} link={preview} />;
}
