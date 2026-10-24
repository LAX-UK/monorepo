import type { AccountNavId } from "@/server/domain/account-nav.vm";

const PATHS: Record<AccountNavId, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  "personal-details": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
  security: "M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6l-7-3ZM9 12l2.2 2.2L15.5 10",
  portfolio: "M4 7.5h16V19H4zM9 7.5V5h6v2.5M4 12.5h16",
  money: "M3.5 7h17v10h-17zM3.5 10.5h17M7 14.5h3",
  selling: "M3.5 12V4.5H11l9.5 9.5-7 7-9.5-9.5ZM7.75 8.25h.01",
  privacy: "M6 10.5V8a6 6 0 0 1 12 0v2.5M5 10.5h14V20H5zM12 14.5v2",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 16.8v.2",
};

/** Menu icons: decorative, because every entry also carries its label. */
export function AccountNavIcon({ id, className }: { id: AccountNavId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? "size-5 shrink-0"}
    >
      <path d={PATHS[id]} />
    </svg>
  );
}
