import process from "node:process";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const threshold = Number(process.env.COST_ALERT_THRESHOLD ?? "400");
  const response = await fetch("https://api.digitalocean.com/v2/customers/my/balance", {
    headers: { Authorization: `Bearer ${requireEnv("DIGITALOCEAN_TOKEN")}` },
  });
  if (!response.ok) throw new Error(`DigitalOcean billing API returned ${response.status}`);
  const body = (await response.json()) as { month_to_date_balance?: string };
  const monthToDate = Number(body.month_to_date_balance ?? "0");
  if (monthToDate > threshold)
    throw new Error(
      `DigitalOcean month-to-date balance ${monthToDate} exceeds threshold ${threshold}`,
    );
  console.log(`DigitalOcean month-to-date balance ${monthToDate} is below threshold ${threshold}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
