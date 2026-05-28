export function exportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("429") || error.message.toLowerCase().includes("limit")) {
      return "Too many exports running — try again in a few minutes.";
    }
    if (error.message.includes("403") || error.message.toLowerCase().includes("forbidden")) {
      return "You do not have permission to export this data.";
    }
    return error.message;
  }
  return "Export failed — please try again.";
}

export function exportPhaseLabel(phase?: string): string {
  switch (phase) {
    case "counting":
      return "Checking export size…";
    case "fetching":
      return "Fetching rows…";
    case "writing":
      return "Writing file…";
    case "uploading":
      return "Uploading…";
    default:
      return "Processing…";
  }
}
