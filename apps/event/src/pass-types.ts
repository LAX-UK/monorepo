/** Pass view shape returned by GET /events/:slug/pass/:token — mirrors @auction/types for a self-contained microsite build. */

export type OnsiteEventPassView = {
  slug: string;
  title: string;
  guestName: string;
  attendanceSegment: string;
  attendanceSegmentLabel: string;
  plusOne: number;
  plusOneGuestName: string | null;
  partySize: number;
  startsAt: string | null;
  venue: string | null;
  dressCode: string | null;
  passUrl: string;
  qrImageUrl: string;
  checkedInAt: string | null;
  eventClosed: boolean;
  paddleNumber: number | null;
};
