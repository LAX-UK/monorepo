import { redirect } from "next/navigation";

/** Manual review queue merged into payments list (`?manualReview=1`). */
export default function ManualReviewPaymentsRedirect() {
  redirect("/admin/payments?manualReview=1");
}
