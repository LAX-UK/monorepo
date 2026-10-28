"use client";

import {
  type ArtistApplicationFieldErrors,
  type ArtistApplicationFormState,
  withSpareLink,
} from "@/lib/artist-application/artist-application-form";
import { ARTIST_APPLICATION_LIMITS } from "@auction/shop-domain";
import { ApplicationTextArea, ApplicationTextField } from "./application-fields";

type AboutFields = Pick<
  ArtistApplicationFormState,
  "artistName" | "location" | "website" | "socialLinks" | "shortBio"
>;

/** Step 1: the name the artist works under, where they are, where to see more, and a short bio. */
export function ApplicationAboutStep({
  value,
  errors,
  onChange,
}: {
  value: AboutFields;
  errors: ArtistApplicationFieldErrors;
  onChange: (change: Partial<AboutFields>) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <ApplicationTextField
        field="artistName"
        label="Your name as an artist"
        hint="As it should appear on your artist page."
        autoComplete="name"
        maxLength={ARTIST_APPLICATION_LIMITS.artistName}
        value={value.artistName}
        error={errors.artistName}
        onChange={(event) => onChange({ artistName: event.target.value })}
      />
      <ApplicationTextField
        field="location"
        label="Where you live and work"
        hint="City and country, for example Lisbon, Portugal."
        autoComplete="address-level2"
        maxLength={ARTIST_APPLICATION_LIMITS.location}
        value={value.location}
        error={errors.location}
        onChange={(event) => onChange({ location: event.target.value })}
      />
      <ApplicationTextField
        field="website"
        label="Website"
        optional
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="studio.example.com"
        maxLength={ARTIST_APPLICATION_LIMITS.url}
        value={value.website}
        error={errors.website}
        onChange={(event) => onChange({ website: event.target.value })}
      />
      <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <legend className="mb-1.5 p-0 font-body text-sm font-semibold text-on-surface">
          Social media <span className="font-normal text-on-surface-variant">(optional)</span>
        </legend>
        <p className="m-0 text-sm leading-5 text-on-surface-variant">
          Up to {ARTIST_APPLICATION_LIMITS.maxSocialLinks} profiles where you share your work. A new
          box appears as you fill one.
        </p>
        {value.socialLinks.map((link, index) => (
          <ApplicationTextField
            // Boxes only ever grow at the end, so the position is a stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above.
            key={index}
            field={`socialLinks.${index}`}
            label={<span className="sr-only">Social media link {index + 1}</span>}
            type="url"
            inputMode="url"
            placeholder={index === 0 ? "instagram.com/yourname" : "Another profile"}
            maxLength={ARTIST_APPLICATION_LIMITS.url}
            value={link}
            error={errors[`socialLinks.${index}`]}
            onChange={(event) => {
              const next = [...value.socialLinks];
              next[index] = event.target.value;
              onChange({ socialLinks: withSpareLink(next) });
            }}
          />
        ))}
      </fieldset>
      <ApplicationTextArea
        field="shortBio"
        label="A short biography"
        hint="A few sentences that introduce you and your path as an artist."
        maxLength={ARTIST_APPLICATION_LIMITS.shortBio}
        value={value.shortBio}
        error={errors.shortBio}
        onChange={(event) => onChange({ shortBio: event.target.value })}
      />
    </div>
  );
}
