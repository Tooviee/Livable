/**
 * Send a Discord webhook notification when a new request is submitted.
 */
import { getAppointmentSlotLabel } from "@/lib/appointment-slots";

export type NewRequestPayload = {
  name: string;
  email: string;
  phone: string | null;
  category: string;
  message: string;
  requestId: string;
  wantsAppointment?: boolean;
  appointmentPreference?: string;
  appointmentDate?: string;
  appointmentTimeSlot?: string;
  preferredContact?: "zoom" | "email" | "instagram";
  instagramHandle?: string;
};

const MAX_FIELD_VALUE = 1024;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

const VALID_WEBHOOK_PREFIXES = [
  "https://discord.com/api/webhooks/",
  "https://discordapp.com/api/webhooks/",
];

function is_valid_webhook_url(url: string): boolean {
  const u = url.trim();
  return VALID_WEBHOOK_PREFIXES.some((p) => u.startsWith(p));
}

export async function notifyDiscordNewRequest(payload: NewRequestPayload): Promise<void> {
  const raw = process.env.DISCORD_WEBHOOK_URL;
  const url = raw?.trim();
  if (!url) {
    console.warn("[Discord] DISCORD_WEBHOOK_URL not set — skipping webhook");
    return;
  }
  if (!is_valid_webhook_url(url)) {
    console.warn("[Discord] DISCORD_WEBHOOK_URL invalid (must start with https://discord.com/api/webhooks/ or https://discordapp.com/api/webhooks/) — skipping");
    return;
  }

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Name", value: payload.name, inline: true },
    { name: "Email", value: payload.email, inline: true },
    { name: "Category", value: payload.category, inline: true },
  ];

  if (payload.phone) {
    fields.push({ name: "Phone", value: payload.phone, inline: true });
  }

  fields.push({
    name: "Description",
    value: truncate(payload.message, MAX_FIELD_VALUE),
    inline: false,
  });

  fields.push({
    name: "Request ID",
    value: payload.requestId.slice(0, 8) + "…",
    inline: false,
  });

  const contact = payload.preferredContact ?? (payload.wantsAppointment ? "zoom" : "email");
  if (contact === "zoom" && payload.wantsAppointment) {
    const parts: string[] = ["Zoom"];
    if (payload.appointmentDate && payload.appointmentTimeSlot) {
      const d = new Date(payload.appointmentDate + "T12:00:00Z");
      const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      parts.push(`**${dateStr}**, ${getAppointmentSlotLabel(payload.appointmentTimeSlot)}`);
    }
    if (payload.appointmentPreference) parts.push(`Note: ${payload.appointmentPreference}`);
    fields.push({
      name: "Follow-up",
      value: truncate(parts.join(" · "), MAX_FIELD_VALUE),
      inline: false,
    });
  } else if (contact === "email") {
    fields.push({ name: "Follow-up", value: "Email", inline: false });
  } else if (contact === "instagram") {
    const val = payload.instagramHandle ? `Instagram (@${payload.instagramHandle.replace(/^@/, "")})` : "Instagram DM";
    fields.push({ name: "Follow-up", value: truncate(val, MAX_FIELD_VALUE), inline: false });
  }

  try {
    if (process.env.NODE_ENV === "development") {
      console.log("[Discord] Sending webhook...");
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "**New help request**",
        embeds: [
          {
            title: "Livable — New request",
            color: 0x378f79,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[Discord] Webhook failed:", res.status, body);
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[Discord] Webhook sent successfully");
    }
  } catch (err) {
    console.error("[Discord] Webhook error:", err);
  }
}

// ----- Zoom link created or updated (notify admin so they can follow up) -----

export type ZoomLinkChangePayload = {
  requestId: string;
  name: string;
  email: string;
  zoomLink: string;
  kind: "created" | "updated";
};

export async function notifyDiscordZoomLinkChange(payload: ZoomLinkChangePayload): Promise<void> {
  const raw = process.env.DISCORD_WEBHOOK_URL;
  const url = raw?.trim();
  if (!url) {
    console.warn("[Discord] DISCORD_WEBHOOK_URL not set — skipping Zoom link webhook");
    return;
  }
  if (!is_valid_webhook_url(url)) {
    console.warn("[Discord] DISCORD_WEBHOOK_URL invalid — skipping Zoom link webhook");
    return;
  }

  const title = payload.kind === "created"
    ? "Livable — Zoom meeting created"
    : "Livable — Zoom link updated";
  const content = payload.kind === "created"
    ? "**Zoom meeting created** — confirmation email sent. You can send a follow-up if needed."
    : "**Zoom link updated** — consider sending the new link to the user if they had an old one.";

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Request ID", value: payload.requestId.slice(0, 8) + "…", inline: true },
    { name: "Name", value: payload.name, inline: true },
    { name: "Email", value: payload.email, inline: true },
    { name: "Zoom link", value: truncate(payload.zoomLink, MAX_FIELD_VALUE), inline: false },
  ];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        embeds: [
          {
            title,
            color: 0x378f79,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[Discord] Zoom link webhook failed:", res.status, body);
    }
  } catch (err) {
    console.error("[Discord] Zoom link webhook error:", err);
  }
}
