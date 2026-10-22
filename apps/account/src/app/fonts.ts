// Brand font is self-hosted from @auction/branding (packages/branding/fonts) so builds never
// depend on fonts.googleapis.com. next/font/local resolves paths relative to this file and only
// runs in modules the Next compiler processes, so each app declares it here rather than
// importing a shared module from the (tsc-compiled) branding package.
import localFont from "next/font/local";

export const montserrat = localFont({
  src: "../../../../packages/branding/fonts/montserrat-latin-wght-normal.woff2",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
});
