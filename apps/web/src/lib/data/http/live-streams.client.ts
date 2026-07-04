export type LiveStreamsStatus = {
  active: boolean;
};

/** GET /api/sales/live-streams (Next.js route — same-origin). */
export async function fetchLiveStreamsStatus(): Promise<LiveStreamsStatus> {
  try {
    const res = await fetch("/api/sales/live-streams");
    const data = (await res.json()) as LiveStreamsStatus;
    return { active: Boolean(data.active) };
  } catch {
    return { active: false };
  }
}
