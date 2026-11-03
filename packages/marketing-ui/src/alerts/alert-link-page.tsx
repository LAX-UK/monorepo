"use client";

import { Button, ButtonLink, EmptyState, Notice } from "@auction/ui/lax";
import { type ComponentType, type ReactNode, useState } from "react";
import { ALERT_LINK_COPY, type AlertLinkCopy, type AlertLinkProduct } from "./alert-link-copy.js";

type LinkComponent = ComponentType<{ href: string; children: ReactNode; className?: string }>;

export type ConfirmLinkState =
  | { state: "ready"; maskedEmail: string }
  | { state: "already_confirmed" | "expired" | "invalid" };

export type StopLinkState =
  | {
      state: "ready";
      maskedEmail: string;
      topics: { id: string; label: string }[];
      fromTopic: { id: string; label: string } | null;
    }
  | { state: "already_stopped" | "invalid"; maskedEmail?: string };

export type ConfirmResult = "confirmed" | "already_confirmed" | "expired" | "invalid" | "failed";
export type StopResult = "stopped" | "already_stopped" | "invalid" | "failed";
export type StopChoice = { scope: "all" } | { scope: "topic"; topic: string };

type Common = {
  product: AlertLinkProduct;
  /** The app's link component, for client-side navigation. */
  Link: LinkComponent;
  className?: string;
};

export type AlertLinkPageProps =
  | (Common & {
      kind: "confirm";
      link: ConfirmLinkState;
      /** Runs only when the button is pressed; opening the page changes nothing. */
      onConfirm: () => Promise<ConfirmResult>;
    })
  | (Common & {
      kind: "stop";
      link: StopLinkState;
      onStop: (choice: StopChoice) => Promise<StopResult>;
    });

type Screen = {
  illustration: "ticket" | "askew";
  variant: "empty" | "error";
  title: string;
  description: string;
  action?: { label: string; href: string };
  retry?: boolean;
};

function confirmScreen(
  copy: AlertLinkCopy,
  state: ConfirmLinkState["state"] | "done" | "failed",
): Screen | null {
  const c = copy.confirm;
  switch (state) {
    case "ready":
      return null;
    case "done":
    case "already_confirmed":
      return {
        illustration: "ticket",
        variant: "empty",
        title: c.doneTitle,
        description: c.doneDescription,
        action: copy.links.afterConfirm,
      };
    case "expired":
      return {
        illustration: "askew",
        variant: "error",
        title: c.expiredTitle,
        description: c.expiredDescription,
        action: copy.links.askAgain,
      };
    case "invalid":
      return {
        illustration: "askew",
        variant: "error",
        title: c.invalidTitle,
        description: c.invalidDescription,
        action: copy.links.askAgain,
      };
    case "failed":
      return {
        illustration: "askew",
        variant: "error",
        title: c.failedTitle,
        description: c.failedDescription,
        retry: true,
      };
  }
}

function stopScreen(
  copy: AlertLinkCopy,
  state: StopLinkState["state"] | "done" | "failed",
): Screen | null {
  const s = copy.stop;
  switch (state) {
    case "ready":
      return null;
    case "done":
      return {
        illustration: "ticket",
        variant: "empty",
        title: s.stoppedTitle,
        description: s.stoppedDescription,
        action: copy.links.home,
      };
    case "already_stopped":
      return {
        illustration: "ticket",
        variant: "empty",
        title: s.alreadyTitle,
        description: s.alreadyDescription,
        action: copy.links.home,
      };
    case "invalid":
      return {
        illustration: "askew",
        variant: "error",
        title: s.invalidTitle,
        description: s.invalidDescription,
        action: copy.links.home,
      };
    case "failed":
      return {
        illustration: "askew",
        variant: "error",
        title: s.failedTitle,
        description: s.failedDescription,
        retry: true,
      };
  }
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The confirm and stop pages of every product's alerts, on the kit's page-level empty state.
 * Opening a link never changes anything; only the button does. Products differ in copy and in the
 * links they lead to, never in structure.
 */
export function AlertLinkPage(props: AlertLinkPageProps) {
  const copy = ALERT_LINK_COPY[props.product];
  const { Link } = props;
  const [outcome, setOutcome] = useState<"done" | "failed" | null>(null);
  const [terminal, setTerminal] = useState<ConfirmResult | StopResult | null>(null);
  const [working, setWorking] = useState<"all" | "topic" | null>(null);

  const run = async (which: "all" | "topic", action: () => Promise<ConfirmResult | StopResult>) => {
    setWorking(which);
    const result = await action();
    setWorking(null);
    if (result === "failed") {
      setOutcome("failed");
      return;
    }
    setOutcome(null);
    setTerminal(result);
  };

  let screen: Screen | null;
  if (props.kind === "confirm") {
    const base = props.link.state;
    const state =
      outcome === "failed"
        ? "failed"
        : terminal
          ? terminal === "confirmed"
            ? "done"
            : terminal
          : base;
    screen = confirmScreen(copy, state as Parameters<typeof confirmScreen>[1]);
  } else {
    const base = props.link.state;
    const state =
      outcome === "failed"
        ? "failed"
        : terminal
          ? terminal === "stopped"
            ? "done"
            : terminal
          : base;
    screen = stopScreen(copy, state as Parameters<typeof stopScreen>[1]);
  }

  const shell = "pt-[var(--header-height)]";

  if (screen) {
    return (
      <EmptyState
        layout="page"
        className={props.className ?? shell}
        illustration={screen.illustration}
        variant={screen.variant}
        title={screen.title}
        description={screen.description}
        actions={
          screen.retry ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setOutcome(null);
              }}
            >
              {props.kind === "confirm" ? copy.confirm.retryButton : "Try again"}
            </Button>
          ) : screen.action ? (
            <ButtonLink Link={Link} variant="primary" href={screen.action.href}>
              {screen.action.label}
            </ButtonLink>
          ) : null
        }
      />
    );
  }

  if (props.kind === "confirm" && props.link.state === "ready") {
    const { onConfirm } = props;
    return (
      <EmptyState
        layout="page"
        className={props.className ?? shell}
        illustration="ticket"
        title={copy.confirm.readyTitle}
        description={copy.confirm.readyDescription(props.link.maskedEmail)}
        actions={
          <Button
            type="button"
            variant="primary"
            size="lg"
            loading={working !== null}
            onClick={() => void run("all", onConfirm)}
          >
            {copy.confirm.button}
          </Button>
        }
      />
    );
  }

  if (props.kind === "stop" && props.link.state === "ready") {
    const { onStop } = props;
    const { topics, fromTopic, maskedEmail } = props.link;
    const several = topics.length > 1 && fromTopic !== null;
    return (
      <EmptyState
        layout="page"
        className={props.className ?? shell}
        illustration="ticket"
        title={copy.stop.readyTitle}
        description={copy.stop.readyDescription(maskedEmail)}
        control={<p className="text-lax-13 text-lax-muted">{copy.stop.footnote}</p>}
        actions={
          several && fromTopic ? (
            <div className="flex w-full max-w-sm flex-col gap-3">
              <div>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  loading={working === "all"}
                  disabled={working === "topic"}
                  onClick={() => void run("all", () => onStop({ scope: "all" }))}
                >
                  {copy.stop.allButton}
                </Button>
                <p className="mt-1 text-lax-13 text-lax-muted">
                  {copy.stop.allHint(sentence(topics.map((t) => t.label).join(", ")))}
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  loading={working === "topic"}
                  disabled={working === "all"}
                  onClick={() =>
                    void run("topic", () => onStop({ scope: "topic", topic: fromTopic.id }))
                  }
                >
                  {copy.stop.topicButton(fromTopic.label)}
                </Button>
                <p className="mt-1 text-lax-13 text-lax-muted">{copy.stop.topicHint}</p>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              loading={working !== null}
              onClick={() => void run("all", () => onStop({ scope: "all" }))}
            >
              {copy.stop.singleButton}
            </Button>
          )
        }
      />
    );
  }
  return <Notice tone="danger" alert title="This page could not be shown" />;
}
