"use client";

import { NO_NAV_ACTIVITY, type NavActivity } from "@/lib/marketing/nav-activity";
import { type ReactNode, createContext, useContext } from "react";

const NavActivityContext = createContext<NavActivity>(NO_NAV_ACTIVITY);

/** Hands what the catalogue holds to client chrome that builds its own links, such as the palette. */
export function NavActivityProvider({
  activity,
  children,
}: {
  activity: NavActivity;
  children: ReactNode;
}) {
  return <NavActivityContext.Provider value={activity}>{children}</NavActivityContext.Provider>;
}

export function useNavActivity(): NavActivity {
  return useContext(NavActivityContext);
}
