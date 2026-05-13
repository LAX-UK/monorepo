/** Shared brand marks for the social identity providers we support.
 *
 * Centralising the SVGs gives a single source of truth for both the
 * unauthenticated sign-in buttons (`social-sign-in-buttons.tsx`) and the
 * authenticated settings section (`settings-connected-accounts.tsx`),
 * keeping us consistent if Google/Apple update their guidelines.
 */

export type ProviderMarkProvider = "google" | "apple";

type ProviderMarkProps = {
  provider: ProviderMarkProvider;
  /** Tailwind size class. Defaults to `size-5` for sign-in buttons. */
  className?: string;
};

const TITLE: Record<ProviderMarkProvider, string> = {
  google: "Google logo",
  apple: "Apple logo",
};

export function ProviderMark({ provider, className = "size-5 shrink-0" }: ProviderMarkProps) {
  if (provider === "google") {
    return (
      <svg aria-label={TITLE.google} role="img" viewBox="0 0 24 24" className={className}>
        <title>{TITLE.google}</title>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-label={TITLE.apple}
      role="img"
      viewBox="0 0 24 24"
      className={`${className} fill-on-surface`}
    >
      <title>{TITLE.apple}</title>
      <path d="M16.365 1.43c0 1.14-.452 2.226-1.196 3.001-.823.852-2.106 1.518-3.299 1.422-.155-1.149.474-2.331 1.214-3.044.84-.806 2.187-1.435 3.281-1.379zM21.07 17.7c-.586 1.348-.87 1.949-1.629 3.143-1.059 1.665-2.553 3.74-4.402 3.757-1.643.014-2.065-1.066-4.293-1.054-2.226.012-2.693 1.067-4.336 1.054-1.849-.017-3.262-1.892-4.32-3.557C-.84 16.444-1.166 10.997 1.106 8.054c1.612-2.087 4.156-3.31 6.55-3.31 2.44 0 3.974 1.336 5.99 1.336 1.953 0 3.142-1.337 5.964-1.337 2.137 0 4.4 1.165 6.014 3.176-5.28 2.892-4.422 10.435-4.554 9.781z" />
    </svg>
  );
}
