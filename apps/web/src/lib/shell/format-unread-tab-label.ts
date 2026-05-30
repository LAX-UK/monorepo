/** Accessible label for nav tabs that show a decorative unread badge. */
export function formatUnreadTabLabel(label: string, unread: number): string {
  if (unread <= 0) return label;
  const count = unread > 9 ? "9+" : String(unread);
  const noun = unread === 1 ? "unread notification" : "unread notifications";
  return `${label}, ${count} ${noun}`;
}
