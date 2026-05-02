export function shouldProjectToXero(eventType: string): boolean {
  return eventType === "payment.captured";
}
