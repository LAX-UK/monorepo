export type ProjectorEventRow = {
  id: number;
  event_type: string;
  payload: unknown;
};

export function rowsFromExecuteResult(result: unknown): ProjectorEventRow[] {
  if (Array.isArray(result)) return result as ProjectorEventRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ProjectorEventRow[] }).rows ?? [];
  }
  return [];
}
