import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "LAX Art",
  description: "Original works and gallery-led sales",
};

export default function ArtRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
