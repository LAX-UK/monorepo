import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

const jsonHeaders = { "Content-Type": "application/json" } as const;

/** PUT /users/me/time-zone: always use one city in LAX Account. */
export async function saveAccountFixedZone(zone: string): Promise<boolean> {
  try {
    const res = await browserFetch(`${browserApiBase()}/users/me/time-zone`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ mode: "fixed", zone }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** PUT /users/me/time-zone: follow the device. The device's zone is stored for emails. */
export async function saveAccountAutomaticZone(deviceZone: string | null): Promise<boolean> {
  try {
    const res = await browserFetch(`${browserApiBase()}/users/me/time-zone`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ mode: "automatic", zone: deviceZone }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** POST /users/me/time-zone/device: remember the zone this device is in (automatic mode only). */
export async function reportDeviceZone(deviceZone: string): Promise<boolean> {
  try {
    const res = await browserFetch(`${browserApiBase()}/users/me/time-zone/device`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ zone: deviceZone }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
