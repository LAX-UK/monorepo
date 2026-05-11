import {
  accountEssentialLinks,
  settlementStageIndex,
} from "@/components/dashboard/overview/overview-presenters";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { BodyText, TimelineStages } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function SecondaryActionStack({
  vm,
  featureV2,
}: {
  vm: DashboardOverviewVm;
  featureV2: boolean;
}) {
  const firstSettlement = vm.settlementsDue[0];
  const firstArtist = vm.artistFollowPreview[0];

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
      <Card className="border-outline-variant/15 bg-surface-container-lowest shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl font-semibold tracking-tight md:text-2xl">
            Settlement path
          </CardTitle>
          <CardDescription>Track payment, invoice, and delivery readiness.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {firstSettlement && featureV2 ? (
            <TimelineStages
              activeIndex={settlementStageIndex(firstSettlement)}
              stages={[
                { id: "inv", label: "Invoice" },
                { id: "pay", label: "Paid" },
                { id: "ship", label: "Shipping" },
                { id: "done", label: "Delivered" },
              ]}
            />
          ) : (
            <BodyText className="text-sm text-on-surface-variant">
              No settlement steps are waiting right now.
            </BodyText>
          )}
          <Button variant="secondary" className="w-full justify-between" asChild>
            <Link href="/dashboard/portfolio">
              Open collection
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-outline-variant/15 bg-surface-container-lowest shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl font-semibold tracking-tight md:text-2xl">
            Account essentials
          </CardTitle>
          <CardDescription>Profile, alerts, bidding, and followed artists.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {accountEssentialLinks.map((item) => (
            <Button key={item.href} variant="ghost" className="w-full justify-between" asChild>
              <Link href={item.href}>
                {item.label}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ))}
          {firstArtist ? (
            <p className="pt-2 text-xs text-on-surface-variant">
              Recent artist follow saved {firstArtist.createdAt.toLocaleDateString()}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-outline-variant/15 bg-surface-container-lowest shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl font-semibold tracking-tight md:text-2xl">
            Sell with LAX
          </CardTitle>
          <CardDescription>Submit items for specialist review and cataloguing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BodyText className="text-sm text-on-surface-variant">
            Start with photos, provenance, and condition notes. Approved submissions become draft
            catalog lots for scheduling.
          </BodyText>
          <Button className="w-full" asChild>
            <Link href="/dashboard/submissions/new">Start a submission</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
