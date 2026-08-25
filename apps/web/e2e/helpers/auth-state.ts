import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authDir = path.join(e2eDir, ".auth");

export const roleAuthState = {
  staff: path.join(authDir, "staff.json"),
  staffRoles: path.join(authDir, "staff-roles.json"),
  staffPublic: path.join(authDir, "staff-public.json"),
  catalogueManager: path.join(authDir, "catalogue-manager.json"),
  buyer: path.join(authDir, "buyer.json"),
  finance: path.join(authDir, "finance.json"),
  readonlyStaff: path.join(authDir, "readonly-staff.json"),
  operations: path.join(authDir, "operations.json"),
} as const;

export const sessionProbeReportPath = path.join(authDir, "session-probe.json");
