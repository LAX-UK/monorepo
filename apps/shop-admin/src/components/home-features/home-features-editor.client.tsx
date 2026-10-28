"use client";

import { HOME_FEATURE_SLOT_ORDER } from "@/lib/home-features";
import {
  saveHomeFeatureList,
  searchHomeFeatureCandidates,
} from "@/server/application/home-features-actions.server";
import type { AdminHomeFeatures } from "@auction/shop-contracts";
import { useState } from "react";
import { HomeFeatureList, type HomeFeatureListActions } from "./home-feature-list.client";

const SERVER_ACTIONS: HomeFeatureListActions = {
  search: searchHomeFeatureCandidates,
  save: saveHomeFeatureList,
};

/** The three featured lists, each saved on its own. Read-only when `canEdit` is false. */
export function HomeFeaturesEditor({
  initial,
  canEdit,
}: {
  initial: AdminHomeFeatures;
  canEdit: boolean;
}) {
  const [features, setFeatures] = useState(initial);
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-6">
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
