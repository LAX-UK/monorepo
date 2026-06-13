"use client";

import {
  CONSENT_CATEGORY_ANALYTICS,
  CONSENT_CATEGORY_MARKETING,
} from "@/lib/analytics/consent/categories";
import { useConsent } from "@/lib/analytics/consent/context";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
} from "@auction/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Preferences dialog (banner &ldquo;Customise&rdquo; + footer &ldquo;Cookie preferences&rdquo;). */
export function ConsentPreferencesDialog() {
  const { preferencesOpen, closePreferences, snapshot, saveCustom } = useConsent();
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!preferencesOpen) return;
    setAnalytics(snapshot?.analytics ?? false);
    setMarketing(snapshot?.marketing ?? false);
  }, [preferencesOpen, snapshot]);

  const marketingDisabled = !analytics;

  return (
    <Dialog
      open={preferencesOpen}
      onOpenChange={(open) => {
        if (!open) closePreferences();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cookie preferences</DialogTitle>
          <DialogDescription>
            Choose which optional cookies we may set. Strictly necessary cookies are always on. See
            the{" "}
            <Link href="/cookies" className="text-link underline-offset-4 hover:underline">
              Cookie policy
            </Link>{" "}
            for details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-divider-soft p-4">
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`consent-${CONSENT_CATEGORY_ANALYTICS}`} className="text-on-surface">
                Analytics
              </Label>
              <p id="consent-analytics-desc" className="font-body text-xs text-on-surface-variant">
                Helps us measure traffic and improve the experience (Google Tag Manager / Google
                Analytics).
              </p>
            </div>
            <Switch
              id={`consent-${CONSENT_CATEGORY_ANALYTICS}`}
              checked={analytics}
              onCheckedChange={(v) => {
                setAnalytics(v);
                if (!v) setMarketing(false);
              }}
              aria-describedby="consent-analytics-desc"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-divider-soft p-4 opacity-100">
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor={`consent-${CONSENT_CATEGORY_MARKETING}`}
                className={marketingDisabled ? "text-on-surface-variant" : "text-on-surface"}
              >
                Marketing
              </Label>
              <p id="consent-marketing-desc" className="font-body text-xs text-on-surface-variant">
                Used for advertising and remarketing tags you configure in GTM. Requires analytics
                to be enabled.
              </p>
            </div>
            <Switch
              id={`consent-${CONSENT_CATEGORY_MARKETING}`}
              checked={marketing}
              disabled={marketingDisabled}
              onCheckedChange={setMarketing}
              aria-describedby="consent-marketing-desc"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={closePreferences}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void saveCustom({ analytics, marketing })}>
            Save preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
