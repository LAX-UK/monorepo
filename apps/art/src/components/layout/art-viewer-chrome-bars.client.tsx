"use client";

import { ArtHeaderClient } from "@/components/header/art-header.client";
import { ArtBottomBar } from "@/components/layout/art-bottom-bar.client";
import { useArtViewerChrome } from "@/components/viewer/art-viewer-chrome.client";
import type { ComponentProps } from "react";

type ArtHeaderStaticProps = Omit<
  ComponentProps<typeof ArtHeaderClient>,
  "account" | "accountSettled" | "replyDot"
>;

/**
 * The header with the visitor the browser has read. Until then the account slot keeps its
 * place, empty (ArtAccountEntry).
 */
export function ArtViewerHeader(props: ArtHeaderStaticProps) {
  const { account, replyDot, settled } = useArtViewerChrome();
  return (
    <ArtHeaderClient {...props} account={account} accountSettled={settled} replyDot={replyDot} />
  );
}

/**
 * The phone tab bar with the visitor the browser has read. Until then the Account tab's icon is
 * an empty space of the same size (ArtBottomBar `pending`).
 */
export function ArtViewerBottomBar() {
  const { account, replyDot, settled } = useArtViewerChrome();
  return (
    <ArtBottomBar
      pending={!settled}
      signedOut={account.kind === "guest"}
      replyDot={replyDot}
      viewer={
        account.kind === "authenticated"
          ? { displayName: account.displayName, email: account.email }
          : null
      }
    />
  );
}
