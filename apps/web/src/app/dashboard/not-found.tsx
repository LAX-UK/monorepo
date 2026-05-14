import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <DashboardEmptyState
        title="That section doesn't exist"
        description="The dashboard URL you opened isn't a known route. Return to the overview to find what you need."
        action={
          <Button variant="cta" asChild>
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
