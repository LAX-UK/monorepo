import { AuctionInterestsSettingsForm } from "@/components/dashboard/auction-interests-settings-form";
import { NotificationPreferencesForm } from "@/components/dashboard/notification-preferences-form";
import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { EmailStatusBanner } from "@/components/layout/email-status-banner";
import {
  AppearanceLayoutPreferencesForm,
  type AppearancePreferencesSnapshot,
} from "@/components/settings/appearance-layout-preferences-form";
import { ReduceMotionCard } from "@/components/settings/reduce-motion-card";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { type BiddingOrganisation, biddingStanding } from "@/lib/settings/bidding-standing";
import { Button } from "@auction/ui/components/button";
import type { LayoutViewDefault, ThemePreference } from "@auction/validators";
import { ExternalLink, UserRound } from "lucide-react";
import Link from "next/link";
import { BidSettingsSection } from "./bid-settings-section";

/** A section whose settings could not be read: the rest of the page still works. */
function SectionUnavailable({ what }: { what: string }) {
  return (
    <DashboardErrorAlert
      title={`We couldn't load your ${what}`}
      message="This is on our side and your saved choices have not changed. Reload the page to try again."
    />
  );
}

/** Whether the person can bid, and how to raise their limit. Alerts live under Notifications. */
export function BiddingSettings({
  user,
  organisation = null,
}: {
  user: SessionUser;
  organisation?: BiddingOrganisation | null;
}) {
  return (
    <BidSettingsSection
      id="bidding"
      title="Bidding"
      description={
        organisation
          ? `Where ${organisation.name} stands to bid.`
          : "Where you stand to bid on LAX Bid."
      }
    >
      <ul className="divide-y divide-outline-variant/50 rounded-xl border border-outline-variant/60 bg-surface-container-lowest">
        {biddingStanding(user.kycStatus, organisation).map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-body text-[0.9375rem] font-semibold text-on-surface">
                {row.title}
              </p>
              <p className="mt-0.5 font-body text-sm text-on-surface-variant">{row.detail}</p>
            </div>
            {row.action ? (
              <Button
                variant="secondaryOutline"
                size="default"
                asChild
                className="self-start sm:self-center"
              >
                <Link href={row.action.href}>{row.action.label}</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </BidSettingsSection>
  );
}

export async function NotificationSettings({ user }: { user: SessionUser }) {
  const c = await getServerDataContainer();
  const prefs = await c.notificationPreferences.getMine().catch(() => null);
  return (
    <BidSettingsSection
      id="notifications"
      title="Notifications"
      description="What we tell you about, and where. Outbid alerts can't be turned off while you're bidding."
    >
      <div className="flex flex-col gap-8">
        {/* Alerts only reach an address that can receive them, so a problem shows here. */}
        <EmailStatusBanner user={user} />
        {prefs ? (
          <NotificationPreferencesForm initial={prefs} />
        ) : (
          <SectionUnavailable what="notification preferences" />
        )}
        {/* What to watch lives on Watching; these settings say how alerts reach the person. */}
        <p className="border-t border-outline-variant/50 pt-6 font-body text-sm text-on-surface-variant">
          Saved searches and artist alerts are in{" "}
          <Link
            href={`${CLIENT_ROUTES.watching}?tab=searches`}
            className="text-on-surface underline underline-offset-4 hover:decoration-2"
          >
            Watching
          </Link>
          .
        </p>
      </div>
    </BidSettingsSection>
  );
}

export async function InterestsSettings() {
  const loaded = await Promise.all([getServerCategoryReader(), getServerCategoryInterests()])
    .then(async ([reader, interests]) => ({ categories: await reader.list(), interests }))
    .catch(() => null);
  return (
    <BidSettingsSection
      id="interests"
      title="Interests"
      description="We use these for sale suggestions and the weekly email."
    >
      {loaded ? (
        <AuctionInterestsSettingsForm
          categoryIdBySlug={Object.fromEntries(
            loaded.categories.map((category) => [category.slug, category.id]),
          )}
          initialCategoryIds={loaded.interests.categoryIds}
        />
      ) : (
        <SectionUnavailable what="interests" />
      )}
    </BidSettingsSection>
  );
}

export function AppearanceSettings({ user }: { user: SessionUser }) {
  const p = user.uiPreferences;
  const initial: AppearancePreferencesSnapshot = {
    theme: (p?.theme ?? "system") as ThemePreference,
    viewLotsDefault: (p?.viewLotsDefault ?? "auto") as LayoutViewDefault,
    viewArtistsDefault: (p?.viewArtistsDefault ?? "auto") as LayoutViewDefault,
    viewSalesDefault: (p?.viewSalesDefault ?? "auto") as LayoutViewDefault,
    viewSync: p?.viewSync ?? false,
  };
  return (
    <BidSettingsSection id="appearance" title="Appearance" description="How LAX Bid looks for you.">
      <div className="flex flex-col gap-6">
        <AppearanceLayoutPreferencesForm initial={initial} />
        <ReduceMotionCard />
      </div>
    </BidSettingsSection>
  );
}

export function ProfileAndSecurity() {
  return (
    <BidSettingsSection
      id="profile"
      title="Profile and security"
      description="The same for every LAX product."
    >
      <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 sm:flex-row sm:items-center md:p-5">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-high text-on-surface max-sm:hidden"
        >
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-base font-semibold text-on-surface">
            Name, email, addresses and sign-in
          </p>
          <p className="mt-1 font-body text-sm text-on-surface-variant">
            Managed once in LAX Account, for LAX Bid, LAX Shop and lax.art.
          </p>
        </div>
        <Button variant="secondaryOutline" size="default" asChild className="shrink-0">
          <a href={laxAccountHomeUrl()}>
            Open LAX Account
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </div>
    </BidSettingsSection>
  );
}
