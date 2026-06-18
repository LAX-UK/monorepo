"use client";

import {
  type StreamUrlVerifyPayload,
  verifyStreamUrlAction,
} from "@/lib/actions/stream-url-verify";
import { cn } from "@auction/ui";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { parseStreamEmbedUrl } from "@auction/validators";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
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
        const trimmed = currentUrl.trim();
        if (!trimmed) return null;
        if (trimmed === initialValue.trim()) return null;
        if (!parseStreamEmbedUrl(trimmed)) {
          return "Unsupported stream URL. Use YouTube, Vimeo, Twitch, or Cloudflare Stream.";
        }
        if (!isResultState(state)) return null;
        if (state.result.status === "not_found") {
          return "Stream not found or not embeddable. Check the link and Vimeo privacy/embed settings.";
        }
        if (state.result.status === "unsupported") {
          return "Unsupported stream URL. Use YouTube, Vimeo, Twitch, or Cloudflare Stream.";
        }
        return null;
      },
    };
    return () => {
      gateRef.current = null;
    };
  }, [gateRef, initialValue, state]);

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
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          type="button"
          variant="outline"
          size="sm"
          loading={pending || state.kind === "checking"}
          loadingLabel="Checking…"
          disabled={disabled || !value.trim()}
          onClick={() => runVerify(value)}
          className="min-h-9"
        >
          Verify link
        </LoadingButton>
        {value.trim() && initialValue.trim() && value.trim() === initialValue.trim() ? (
          <span className="font-body text-xs text-on-surface-variant">Current saved link</span>
        ) : null}
      </div>

      {error ? (
        <p className="flex items-start gap-2 font-body text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {showFeedback && !error && result ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 font-body text-sm",
            result.status === "unverified"
              ? "border-warning/40 bg-warning/5 text-on-surface-variant"
              : "border-outline-variant/30 bg-surface-container-lowest/50 text-on-surface-variant",
          )}
        >
          {result.status === "verified" ? (
            <>
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-on-surface">
                  {result.title ? `"${result.title}"` : "Stream link verified"}
                </p>
                {result.thumbnailUrl ? (
                  <img
                    src={result.thumbnailUrl}
                    alt=""
                    className="mt-2 h-12 w-20 rounded object-cover"
                  />
                ) : null}
              </div>
            </>
          ) : null}
          {result.status === "unverified" ? (
            <>
              <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>
                Could not confirm embeddability (provider may be temporarily unavailable). You can
                still save if the URL looks correct.
              </p>
            </>
          ) : null}
          {result.status === "live_check_unavailable" ? (
            <>
              <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>Format accepted. Live embed check is not available for this provider.</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
