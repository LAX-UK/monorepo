import { AuctionInterestsSettingsForm } from "@/components/dashboard/auction-interests-settings-form";
import { EmailStatusBanner } from "@/components/layout/email-status-banner";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerCategoryInterests } from "@/lib/data/http/category-interests.server";
import { getServerNotificationMutes } from "@/lib/data/http/notifications-inbox.server";
import { loadBiddingOrganisation } from "@/lib/settings/bidding-card.server";
import { biddingRows } from "@/lib/settings/bidding-standing";
import type { ThemePreference } from "@auction/validators";
import { AlertsSettings } from "./alerts-settings";
import { AppearanceSettings } from "./appearance-settings";
import { BidSettingsSection, BidSettingsSectionError } from "./bid-settings-section";
import { BiddingCard } from "./bidding-card";
import { MutedOrganisations } from "./muted-organisations";

/**
 * Bidding: for yourself, your identity check and limit; inside an organisation, its check, its
 * limit, who can bid and, for a buyer agent, their own authorisation.
 */
export async function BiddingSettings({ user }: { user: SessionUser }) {
  const organisation = await loadBiddingOrganisation(user).catch(() => undefined);
  if (organisation === undefined) {
    return (
      <BidSettingsSection id="bidding" title="Bidding" description="Where you stand to bid.">
        <BidSettingsSectionError what="bidding details" />
      </BidSettingsSection>
    );
  }
  return (
    <BidSettingsSection
      id="bidding"
      title="Bidding"
      description={
        organisation
          ? `Where ${organisation.name} stands to bid. It applies to every member who bids for it.`
          : "Where you stand to bid on LAX Bid."
      }
    >
      <BiddingCard rows={biddingRows(user.kycStatus, organisation)} />
    </BidSettingsSection>
  );
}

/**
 * Alerts: the style, where each alert reaches you, quiet hours, and the organisations you muted.
 * Saved searches and artist alerts live in Watching.
 */
export async function AlertsSection({
  user,
  belongsToOrganisations,
}: {
  user: SessionUser;
  /** Mutes only mean something to a member of an organisation. */
  belongsToOrganisations: boolean;
}) {
  const c = await getServerDataContainer();
  const [prefs, mutes] = await Promise.all([
    c.notificationPreferences.getMine().catch(() => null),
    belongsToOrganisations ? getServerNotificationMutes() : Promise.resolve(null),
  ]);
  return (
    <BidSettingsSection
      id="alerts"
      title="Alerts"
      description="What we tell you about, and where. Alerts that protect a bid or a payment stay on while you're bidding."
    >
      {/* Alerts only reach an address that can receive them, so a problem shows here. */}
      <EmailStatusBanner user={user} />
      {prefs ? <AlertsSettings initial={prefs} /> : <BidSettingsSectionError what="alerts" />}
      {belongsToOrganisations ? (
        mutes ? (
          <MutedOrganisations initial={mutes} />
        ) : (
          <BidSettingsSectionError what="muted organisations" />
        )
      ) : null}
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
        <BidSettingsSectionError what="interests" />
      )}
    </BidSettingsSection>
  );
}

export function AppearanceSection({ user }: { user: SessionUser }) {
  return (
    <BidSettingsSection
      id="appearance"
      title="Appearance"
      description="Follows your device unless you choose."
    >
      <AppearanceSettings
        initialTheme={(user.uiPreferences?.theme ?? "system") as ThemePreference}
      />
    </BidSettingsSection>
  );
}
