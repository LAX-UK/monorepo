import { runLegacyDemoSeed } from "../dev/legacy-demo-seed.js";

export async function runDevSeed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the destructive dev seed when NODE_ENV=production.");
  }
  await runLegacyDemoSeed();
}
