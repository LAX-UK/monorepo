import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authDir = path.join(e2eDir, ".auth");

export const roleAuthState = {
  staff: path.join(authDir, "staff.json"),
  catalogueManager: path.join(authDir, "catalogue-manager.json"),
  buyer: path.join(authDir, "buyer.json"),
} as const;
