import { pathToFileURL } from "node:url";
import pg from "pg";
import { formatUserReadCutover, readUserReadCutover } from "../applied-user-read-cutover.js";
import { buildPgConnectionConfig } from "../ssl.js";

export async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_OWNER required");
  const client = new pg.Client(buildPgConnectionConfig(url));
  await client.connect();
  try {
    console.log(formatUserReadCutover(await readUserReadCutover(client)));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
