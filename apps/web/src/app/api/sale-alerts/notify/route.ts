/**
 * The home page's sign-up address before alerts moved to /api/alerts/notify. Pages cached before
 * the move still post here, so it stays for 90 days and does exactly what the new route does.
 */
export { POST } from "@/app/api/alerts/notify/route";
