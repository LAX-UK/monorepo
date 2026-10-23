import { loadAccountSession } from "@/server/application/load-account-session";
import { getLaxAccountContainer } from "@/server/container";
import { buildAccountLinks } from "@/server/domain/account-links";
import { buildAccountNav, buildProductBar } from "@/server/domain/account-nav.vm";
import { cache } from "react";
import type { ReactNode } from "react";
import { AccountFrame, type AccountFrameProps } from "./shell/account-frame";
import { type AccountViewer, toAccountViewer } from "./shell/account-viewer";

/** One session read per request, however many parts of the page ask who is signed in. */
const loadViewer = cache(async (): Promise<AccountViewer | null> => {
  const session = await loadAccountSession();
  return session.status === "ok" ? toAccountViewer(session.overview) : null;
});

/**
 * The shell for a server-rendered page: the header, product bar and left menu from
 * `AccountFrame`, filled in with the signed-in person and the configured LAX products. A page that
 * has already read the person (with a live name, say) passes `viewer` so the header agrees with it.
 */
export async function AccountShell({
  children,
  width = "narrow",
  viewer: viewerProp,
}: {
  children: ReactNode;
  width?: AccountFrameProps["width"];
  viewer?: AccountViewer | null;
}) {
  const { config } = getLaxAccountContainer();
  const links = buildAccountLinks(config);
  const viewer = viewerProp === undefined ? await loadViewer() : viewerProp;
  return (
    <AccountFrame
      viewer={viewer}
      nav={viewer ? buildAccountNav(links) : []}
      products={buildProductBar(config)}
      support={links.support}
      width={width}
    >
      {children}
    </AccountFrame>
  );
}
