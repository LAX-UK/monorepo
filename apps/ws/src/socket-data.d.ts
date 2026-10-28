import "socket.io";

declare module "socket.io" {
  interface SocketData {
    userId?: string;
    isAdmin?: boolean;
    /** `staffRoles`: the staff roles in force when the ticket was issued. */
    ticketUser?: { id: string; sid?: string; role: string; staffRoles: readonly string[] };
  }
}
