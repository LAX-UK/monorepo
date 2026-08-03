import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authDir = path.join(e2eDir, ".auth");

export const roleAuthState = {
  staff: path.join(authDir, "staff.json"),
  catalogueManager: path.join(authDir, "catalogue-manager.json"),
  buyer: path.join(authDir, "buyer.json"),
  finance: path.join(authDir, "finance.json"),
  readonlyStaff: path.join(authDir, "readonly-staff.json"),
  operations: path.join(authDir, "operations.json"),
} as const;
