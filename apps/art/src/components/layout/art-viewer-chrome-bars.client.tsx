"use client";

import { ArtHeaderClient } from "@/components/header/art-header.client";
import { ArtBottomBar } from "@/components/layout/art-bottom-bar.client";
import { useArtViewerChrome } from "@/components/viewer/art-viewer-chrome.client";
import type { ComponentProps } from "react";

type ArtHeaderStaticProps = Omit<ComponentProps<typeof ArtHeaderClient>, "account" | "replyDot">;

/** The header with the visitor the browser has read (a guest until then). */
export function ArtViewerHeader(props: ArtHeaderStaticProps) {
  const { account, replyDot } = useArtViewerChrome();
  return <ArtHeaderClient {...props} account={account} replyDot={replyDot} />;
}

/** The phone tab bar with the visitor the browser has read (a guest until then). */
export function ArtViewerBottomBar() {
  const { account, replyDot } = useArtViewerChrome();
  return (
    <ArtBottomBar
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
