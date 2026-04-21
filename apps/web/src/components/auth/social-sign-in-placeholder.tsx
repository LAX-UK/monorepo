"use client";

/**
 * Reserved slot for OAuth / social sign-in when backend is ready.
 * Hidden from assistive tech until wired.
 */
export function SocialSignInPlaceholder() {
  return (
    <div
      className="rounded-md border border-dashed border-outline-variant/40 bg-surface-container-low/30 px-4 py-6 text-center"
      aria-hidden
    >
      <p className="font-label text-[0.65rem] font-semibold uppercase tracking-widest text-on-surface-variant">
        More sign-in options
      </p>
      <p className="mt-2 font-footer-links text-xs text-on-surface-variant/80">Coming soon</p>
    </div>
  );
}
