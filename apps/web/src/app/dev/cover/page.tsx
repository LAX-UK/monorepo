import { isCoverFixtureReviewAvailable } from "@/lib/marketing-cover/cover-fixture-review";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { MarketingCover } from "@auction/marketing-ui";
import {
  BID_COVER_FIXTURES,
  COVER_BEHAVIOUR_FIXTURES,
  type CoverFixture,
  SHOP_COVER_FIXTURES,
} from "@auction/marketing-ui/cover-fixtures";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Cover scenarios",
  "Every cover scenario on fixture data.",
);

const GROUPS: readonly { title: string; fixtures: readonly CoverFixture[] }[] = [
  { title: "LAX Bid", fixtures: BID_COVER_FIXTURES },
  { title: "LAX Shop", fixtures: SHOP_COVER_FIXTURES },
  { title: "Behaviour", fixtures: COVER_BEHAVIOUR_FIXTURES },
];

type Props = { searchParams: Promise<{ only?: string }> };

/**
 * The cover on fixture data, one block per design scenario. `?only=<id>` shows a single one.
 * Development and test runs only: a production build answers 404.
 */
export default async function CoverFixturePage({ searchParams }: Props) {
  if (!isCoverFixtureReviewAvailable(process.env.NODE_ENV)) notFound();
  const { only } = await searchParams;
  return (
    <main className="min-h-dvh bg-surface text-on-surface">
      {GROUPS.map((group) => (
        <div key={group.title}>
          {only ? null : (
            <h2 className="px-4 py-6 font-headline text-xl font-medium md:px-10">{group.title}</h2>
          )}
          {group.fixtures
            .filter((fixture) => !only || fixture.id === only)
            .map((fixture) => (
              <div key={fixture.id} id={fixture.id}>
                {only ? null : (
                  <p className="px-4 py-3 font-body text-sm text-on-surface-variant md:px-10">
                    <strong className="font-medium text-on-surface">{fixture.label}.</strong>{" "}
                    {fixture.note}
                  </p>
                )}
                <MarketingCover
                  slides={fixture.slides}
                  label={fixture.label}
                  priority={only === fixture.id}
                />
              </div>
            ))}
        </div>
      ))}
    </main>
  );
}
