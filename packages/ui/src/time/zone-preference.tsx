"use client";

import { type ReactNode, createContext, useContext } from "react";
import { saveChosenViewerZone } from "./viewer-zone-store.js";

/**
 * Where a zone the visitor picks in the sheet is saved. Signed out it is this device; LAX Account
 * provides its own port when it saves the choice for emails too.
 */
export type ZonePreferencePort = {
  save: (zone: string) => Promise<void> | void;
  /** The line under the choice: where it goes. */
  savedNote: string;
};

export const deviceZonePreference: ZonePreferencePort = {
  save: saveChosenViewerZone,
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
