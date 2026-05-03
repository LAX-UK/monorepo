import { SegmentNotFound } from "@/components/marketing/segment-not-found";

export default function DashboardNotFound() {
  return (
    <SegmentNotFound
      kicker="404 \u00B7 Dashboard"
      title="That section doesn't exist"
      description="The dashboard URL you opened isn't a known route. Return to the overview to find what you need."
      primaryHref="/dashboard"
      primaryLabel="Open dashboard"
    />
  );
}
