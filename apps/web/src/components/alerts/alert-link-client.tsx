"use client";

import { confirmAlertLink, stopAlertLink } from "@/lib/data/http/alerts.client";
import {
  AlertLinkPage,
  type ConfirmLinkState,
  type StopChoice,
  type StopLinkState,
} from "@auction/marketing-ui/alerts/alert-link-page";
import Link from "next/link";

/** The confirm page's button: the request is made on the press and not before. */
export function ConfirmAlertLink({ token, link }: { token: string; link: ConfirmLinkState }) {
  return (
    <AlertLinkPage
      kind="confirm"
      product="bid"
      Link={Link}
      link={link}
      onConfirm={() => confirmAlertLink(token)}
    />
  );
}

export function StopAlertLink({ token, link }: { token: string; link: StopLinkState }) {
  return (
    <AlertLinkPage
      kind="stop"
      product="bid"
      Link={Link}
      link={link}
      onStop={(choice: StopChoice) => stopAlertLink(token, choice)}
    />
  );
}
