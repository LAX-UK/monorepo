import type { AdminTelephoneBookingRow } from "@/lib/telephone/telephone-booking-types";

export type AdminSaleOperationsSnapshot = {
  sale: {
    id: string;
    title: string;
    status: string;
    deliveryMode: string;
    startTime: string | null;
    venueName: string | null;
    streamUrl: string | null;
  };
  saleroomSession: {
    status: string;
    currentLotId: string | null;
    currentLotNumber: number | null;
    currentLotTitle: string | null;
  } | null;
  currentLotBidding: {
    currentPrice: string;
    leaderRef: string | null;
    bidCount: number;
  } | null;
  registrations: { pending: number; approved: number; rejected: number };
  telephoneBookings: {
    requested: number;
    confirmed: number;
    inProgress: number;
    completed: number;
  };
  pendingActions: {
    registrations: Array<{
      id: string;
      status: string;
      userName: string | null;
      userEmail: string | null;
    }>;
    telephone: AdminTelephoneBookingRow[];
  };
};
