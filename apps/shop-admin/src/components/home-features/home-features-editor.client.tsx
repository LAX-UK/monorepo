"use client";

import { HOME_FEATURE_SLOT_ORDER } from "@/lib/home-features";
import {
  removeHomeCover,
  saveHomeCover,
  searchHomeCoverPictures,
} from "@/server/application/home-cover-actions.server";
import {
  saveHomeFeatureList,
  searchHomeFeatureCandidates,
} from "@/server/application/home-features-actions.server";
import type { AdminHomeCover, AdminHomeFeatures } from "@auction/shop-contracts";
import { useState } from "react";
import { type HomeCoverActions, HomeCoverSection } from "./home-cover-section.client";
import { HomeFeatureList, type HomeFeatureListActions } from "./home-feature-list.client";

const SERVER_ACTIONS: HomeFeatureListActions = {
  search: searchHomeFeatureCandidates,
  save: saveHomeFeatureList,
};

const COVER_ACTIONS: HomeCoverActions = {
  search: searchHomeCoverPictures,
  save: saveHomeCover,
  remove: removeHomeCover,
};

/** The cover image and the three featured lists, each saved on its own. Read-only when `canEdit` is false. */
export function HomeFeaturesEditor({
  initial,
  cover,
  canEdit,
}: {
  initial: AdminHomeFeatures;
  cover: AdminHomeCover | null;
  canEdit: boolean;
}) {
  const [features, setFeatures] = useState(initial);
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-6">
      <HomeCoverSection saved={cover} {...(canEdit && cover ? { actions: COVER_ACTIONS } : {})} />
      {HOME_FEATURE_SLOT_ORDER.map((slot) => (
        <HomeFeatureList
          key={slot}
          slot={slot}
          saved={features[slot]}
          {...(canEdit ? { actions: SERVER_ACTIONS, onSaved: setFeatures } : {})}
        />
      ))}
    </div>
  );
}
