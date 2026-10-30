import { Field, Notice, StaffButton, TextInput } from "@auction/staff-ui";
import type { RefObject } from "react";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** True when the browser can scan, false when it cannot, null while that is being checked. */
  cameraSupported: boolean | null;
  manualToken: string;
  onManualTokenChange: (value: string) => void;
  busy: boolean;
  onCheckIn: (token: string) => void;
};

/** Scan a pass with the camera, or paste its link or token. */
export function CheckInScanTab({
  videoRef,
  cameraSupported,
  manualToken,
  onManualTokenChange,
  busy,
  onCheckIn,
}: Props) {
  const token = manualToken.trim();
  return (
    <div className="flex flex-col gap-4">
      {cameraSupported === false ? (
        <Notice tone="info" title="Camera scanning is unavailable on this device">
          Paste the pass link or token below, or search for the guest by name.
        </Notice>
      ) : (
        <div className="overflow-hidden rounded-staff-lg border border-staff-line bg-staff-sunken">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            muted
            playsInline
            aria-label="QR code scanner camera preview"
          />
        </div>
      )}
      {cameraSupported === null ? (
        <p className="text-staff-sm text-staff-muted">Starting camera…</p>
      ) : null}
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (token && !busy) onCheckIn(token);
        }}
      >
        <Field label="Or paste a pass link or token" id="check-in-manual-token">
          <TextInput
            value={manualToken}
            onChange={(event) => onManualTokenChange(event.target.value)}
            placeholder="https://event.lax.bid/pass/…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <StaffButton
          type="submit"
          variant="primary"
          loading={busy}
          {...(token ? {} : { disabledReason: "Paste a pass link or token first" })}
        >
          Check in
        </StaffButton>
      </form>
    </div>
  );
}
