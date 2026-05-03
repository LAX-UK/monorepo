import { SegmentNotFound } from "@/components/marketing/segment-not-found";

export default function AdminNotFound() {
  return (
    <SegmentNotFound
      kicker="404 \u00B7 Admin"
      title="That admin route doesn't exist"
      description="Check the URL or return to the operations cockpit."
      primaryHref="/admin"
      primaryLabel="Operations"
    />
  );
}
