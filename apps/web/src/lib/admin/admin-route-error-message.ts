const DEFAULT_MESSAGE = "Something went wrong loading this page. Try again or return to the list.";

/** Hide raw server errors in production route boundaries. */
export function adminRouteErrorMessage(error: Error): string {
  if (process.env.NODE_ENV === "development" && error.message.trim()) {
    return error.message;
  }
  return DEFAULT_MESSAGE;
}
