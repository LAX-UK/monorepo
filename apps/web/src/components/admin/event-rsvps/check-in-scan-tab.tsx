import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Surface } from "@auction/ui/components/surface";
import type { RefObject } from "react";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraSupported: boolean | null;
  manualToken: string;
  onManualTokenChange: (value: string) => void;
  busy: boolean;
  onCheckIn: (token: string) => void;
};

export function CheckInScanTab({
  videoRef,
  cameraSupported,
  manualToken,
  onManualTokenChange,
  busy,
  onCheckIn,
}: Props) {
  return (
    <div className="space-y-4">
      <Surface className="overflow-hidden p-0">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full bg-black object-cover"
          muted
          playsInline
          aria-label="QR code scanner camera preview"
        />
      </Surface>
      {cameraSupported === null ? (
        <p className="font-body text-sm text-on-surface-variant">Starting camera…</p>
      ) : null}
      {cameraSupported === false ? (
        <output aria-live="polite" className="block font-body text-sm text-on-surface-variant">
          Camera scanning is unavailable on this device. Paste the pass link or token below, or use
          Search name.
        </output>
      ) : null}
      <div className="space-y-2">
        <label className="font-body text-sm text-on-surface-variant" htmlFor="manual-token">
          Or paste pass link / token
        </label>
        <Input
          id="manual-token"
          value={manualToken}
          onChange={(e) => onManualTokenChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && manualToken.trim() && !busy) {
              onCheckIn(manualToken.trim());
            }
          }}
          placeholder="https://event.lax.bid/pass/…"
        />
        <Button
          type="button"
          className="w-full min-h-11"
          disabled={!manualToken.trim() || busy}
          onClick={() => onCheckIn(manualToken.trim())}
        >
          {busy ? "Checking in…" : "Check in"}
        </Button>
      </div>
    </div>
  );
}
