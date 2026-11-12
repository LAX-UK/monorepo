"use client";

import { type ReactNode, createContext, useContext } from "react";
import { followDeviceViewerZone, saveChosenViewerZone } from "./viewer-zone-store.js";

/**
 * Where a zone the visitor picks in the sheet is saved. Signed out it is this device; LAX Account
 * provides its own port when it saves the choice for emails too.
 */
export type ZonePreferencePort = {
  /** Always use this zone. */
  save: (zone: string) => Promise<void> | void;
  /** Follow the device's own zone ("Automatic"). */
  followDevice: () => Promise<void> | void;
  /** The line under the choice: where it goes. Left out where the page says it elsewhere. */
  savedNote?: string;
};

export const deviceZonePreference: ZonePreferencePort = {
  save: saveChosenViewerZone,
  followDevice: followDeviceViewerZone,
  savedNote: "Saved on this device. Sign in to use it in your emails too.",
};

const ZonePreferenceContext = createContext<ZonePreferencePort>(deviceZonePreference);

export function ZonePreferenceProvider({
  port,
  children,
}: {
  port: ZonePreferencePort;
  children: ReactNode;
}) {
  return <ZonePreferenceContext.Provider value={port}>{children}</ZonePreferenceContext.Provider>;
}

export function useZonePreference(): ZonePreferencePort {
  return useContext(ZonePreferenceContext);
}
