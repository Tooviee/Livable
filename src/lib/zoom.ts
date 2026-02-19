/**
 * Zoom API helpers (Server-to-Server OAuth).
 */

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

export async function getZoomAccessToken(): Promise<string> {
  const missing: string[] = [];
  if (!ZOOM_ACCOUNT_ID?.trim()) missing.push("ZOOM_ACCOUNT_ID");
  if (!ZOOM_CLIENT_ID?.trim()) missing.push("ZOOM_CLIENT_ID");
  if (!ZOOM_CLIENT_SECRET?.trim()) missing.push("ZOOM_CLIENT_SECRET");
  if (missing.length > 0) {
    throw new Error(`Zoom credentials not configured. Missing in env: ${missing.join(", ")}. Set them in Vercel → Project → Settings → Environment Variables for Production.`);
  }
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: ZOOM_ACCOUNT_ID,
      client_id: ZOOM_CLIENT_ID,
      client_secret: ZOOM_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Zoom token error:", res.status, text);
    throw new Error("Failed to get Zoom access token.");
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token in Zoom response.");
  return data.access_token;
}

/**
 * Delete a Zoom meeting by ID. Idempotent: 404 from Zoom is treated as success (already deleted).
 */
export async function deleteZoomMeeting(meetingId: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = String(meetingId).trim();
  if (!trimmed) return { ok: false, error: "Missing meeting ID" };
  try {
    const accessToken = await getZoomAccessToken();
    const res = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(trimmed)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 204 || res.status === 404) {
      return { ok: true };
    }
    const text = await res.text();
    console.error("Zoom delete meeting error:", res.status, text);
    return { ok: false, error: `Zoom returned ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Zoom delete meeting error:", msg);
    return { ok: false, error: msg };
  }
}
