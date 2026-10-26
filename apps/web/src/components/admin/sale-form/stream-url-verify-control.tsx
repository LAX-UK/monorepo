"use client";

import {
  type StreamUrlVerifyPayload,
  verifyStreamUrlAction,
} from "@/lib/actions/stream-url-verify";
import { Notice, StaffButton } from "@auction/staff-ui";
import { parseStreamEmbedUrl } from "@auction/validators";
import { type RefObject, useCallback, useEffect, useRef, useState, useTransition } from "react";

export type StreamUrlVerificationGate = {
  assertCanSubmit: (currentUrl: string) => string | null;
};

type VerifyState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; result: StreamUrlVerifyPayload };

function isResultState(
  state: VerifyState,
): state is { kind: "result"; result: StreamUrlVerifyPayload } {
  return state.kind === "result";
}

function formatError(state: VerifyState): string | null {
  if (!isResultState(state)) return null;
  if (state.result.status === "unsupported") {
    return "Unsupported stream URL. Use YouTube, Vimeo, Twitch, or Cloudflare Stream.";
  }
  if (state.result.status === "not_found") {
    return "Stream not found or not embeddable. Check the link and Vimeo privacy/embed settings.";
  }
  return null;
}

type Props = {
  value: string;
  initialValue: string;
  disabled?: boolean;
  gateRef?: RefObject<StreamUrlVerificationGate | null>;
  blurHandlerRef?: RefObject<(() => void) | null>;
};

export function StreamUrlVerifyControl({
  value,
  initialValue,
  disabled = false,
  gateRef,
  blurHandlerRef,
}: Props) {
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const lastVerifiedValueRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const runVerify = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) {
        setState({ kind: "result", result: { status: "empty" } });
        lastVerifiedValueRef.current = "";
        return;
      }
      const parsed = parseStreamEmbedUrl(trimmed);
      if (!parsed) {
        setState({ kind: "result", result: { status: "unsupported" } });
        lastVerifiedValueRef.current = trimmed;
        return;
      }
      if (trimmed === initialValue.trim() && initialValue.trim()) {
        setState({ kind: "result", result: { status: "verified", provider: parsed.provider } });
        lastVerifiedValueRef.current = trimmed;
        return;
      }

      setState({ kind: "checking" });
      startTransition(async () => {
        const result = await verifyStreamUrlAction(trimmed);
        if (!result.ok) {
          setState({ kind: "result", result: { status: "unverified", provider: parsed.provider } });
          lastVerifiedValueRef.current = trimmed;
          return;
        }
        if (result.data) {
          setState({ kind: "result", result: result.data });
        } else {
          setState({ kind: "idle" });
        }
        lastVerifiedValueRef.current = trimmed;
      });
    },
    [initialValue],
  );

  useEffect(() => {
    if (!gateRef) return;
    gateRef.current = {
      assertCanSubmit(currentUrl: string) {
        const currentState = stateRef.current;
        const trimmed = currentUrl.trim();
        if (!trimmed) return null;
        if (trimmed === initialValue.trim()) return null;
        if (!parseStreamEmbedUrl(trimmed)) {
          return "Unsupported stream URL. Use YouTube, Vimeo, Twitch, or Cloudflare Stream.";
        }
        if (!isResultState(currentState)) return null;
        if (currentState.result.status === "not_found") {
          return "Stream not found or not embeddable. Check the link and Vimeo privacy/embed settings.";
        }
        if (currentState.result.status === "unsupported") {
          return "Unsupported stream URL. Use YouTube, Vimeo, Twitch, or Cloudflare Stream.";
        }
        return null;
      },
    };
    return () => {
      gateRef.current = null;
    };
  }, [gateRef, initialValue]);

  useEffect(() => {
    if (!blurHandlerRef) return;
    blurHandlerRef.current = () => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === lastVerifiedValueRef.current) return;
      runVerify(trimmed);
    };
    return () => {
      blurHandlerRef.current = null;
    };
  }, [blurHandlerRef, value, runVerify]);

  useEffect(() => {
    if (
      value.trim() !== lastVerifiedValueRef.current &&
      state.kind !== "idle" &&
      state.kind !== "checking"
    ) {
      setState({ kind: "idle" });
    }
  }, [value, state.kind]);

  const error = formatError(state);
  const result = isResultState(state) ? state.result : null;
  const showFeedback = isResultState(state) && state.result.status !== "empty";

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <StaffButton
          size="sm"
          variant="secondary"
          loading={pending || state.kind === "checking"}
          disabled={disabled || !value.trim()}
          onClick={() => runVerify(value)}
        >
          Verify link
        </StaffButton>
        {value.trim() && initialValue.trim() && value.trim() === initialValue.trim() ? (
          <span className="text-staff-xs text-staff-muted">Current saved link</span>
        ) : null}
      </div>

      {error ? (
        <Notice tone="danger" alert title="This link cannot be used">
          {error}
        </Notice>
      ) : null}

      {showFeedback && !error && result ? (
        result.status === "verified" ? (
          <Notice
            tone="success"
            title={result.title ? `"${result.title}"` : "Stream link verified"}
          >
            {result.thumbnailUrl ? (
              <img
                src={result.thumbnailUrl}
                alt=""
                className="mt-1 h-12 w-20 rounded-staff-xs object-cover"
              />
            ) : null}
          </Notice>
        ) : result.status === "unverified" ? (
          <Notice tone="warning" title="Could not confirm the link can be embedded">
            The provider may be temporarily unavailable. You can still save if the URL looks
            correct.
          </Notice>
        ) : result.status === "live_check_unavailable" ? (
          <Notice tone="info" title="Format accepted">
            Live embed check is not available for this provider.
          </Notice>
        ) : null
      ) : null}
    </div>
  );
}
