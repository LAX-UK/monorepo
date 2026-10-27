/** The API refused a staff request because the session behind it has ended (HTTP 401). */
export class AdminSessionExpiredError extends Error {
  constructor(message = "Your session has ended") {
    super(message);
    this.name = "AdminSessionExpiredError";
  }
}
