import { ConsentShell } from "@/components/marketing/consent/consent-shell";
import { ConsentProvider } from "@/lib/analytics/consent/context";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/analytics/consent/actions", () => ({ setConsentAction: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderShell() {
  return render(
    <ConsentProvider initialSnapshot={null}>
      <ConsentShell />
    </ConsentProvider>,
  );
}

describe("ConsentShell", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("shows the cookie banner on consumer pages", () => {
    renderShell();
    expect(screen.getByRole("region", { name: "Cookies" })).toBeInTheDocument();
  });

  it("never renders the banner inside Bid admin", () => {
    pathname.current = "/admin/sales";
    renderShell();
    expect(screen.queryByRole("region", { name: "Cookies" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept all/i })).not.toBeInTheDocument();
  });
});
