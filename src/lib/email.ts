/**
 * Send confirmation email via Brevo API or Outlook SMTP.
 * Use Brevo if your Outlook has "SmtpClientAuthentication is disabled" (free tier, no SMTP needed).
 */
import nodemailer from "nodemailer";
import { getAppointmentSlotLabel } from "@/lib/appointment-slots";

export type SendConfirmationParams = {
  to: string;
  name: string;
  requestId: string;
  requestDate: string;
  wantsAppointment?: boolean;
  appointmentPreference?: string;
  appointmentDate?: string;
  appointmentTimeSlot?: string;
  preferredContact?: "zoom" | "email" | "instagram";
  instagramHandle?: string;
  rescheduleLink?: string;
};

function formatAppointmentDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

const confirmationHtml = (params: SendConfirmationParams) => {
  const contact = params.preferredContact ?? (params.wantsAppointment ? "zoom" : "email");
  let followUpBlock = "";
  if (contact === "zoom" && params.wantsAppointment) {
    const slotLabel = params.appointmentTimeSlot ? getAppointmentSlotLabel(params.appointmentTimeSlot) : "";
    const dateLine =
      params.appointmentDate && params.appointmentTimeSlot
        ? `<p><strong>Your scheduled slot:</strong> ${formatAppointmentDate(params.appointmentDate)}, ${slotLabel}</p>`
        : "";
    const preferenceLine = params.appointmentPreference
      ? `<p><strong>Note:</strong> ${params.appointmentPreference}</p>`
      : "";
    const rescheduleLine = params.rescheduleLink
      ? `<p>Need to change your appointment? <a href="${params.rescheduleLink}" style="color: #059669;">Use this link</a>.</p>`
      : "";
    followUpBlock = `
  <p>We'll follow up with a virtual Zoom appointment. We'll send you the meeting link once it's confirmed.</p>
  ${dateLine}${preferenceLine}${rescheduleLine}`;
  } else if (contact === "email") {
    followUpBlock = `<p>We'll follow up by email.</p>`;
  } else if (contact === "instagram") {
    const handleLine = params.instagramHandle
      ? `<p><strong>Your Instagram:</strong> @${params.instagramHandle.replace(/^@/, "")}</p>`
      : "";
    followUpBlock = `<p>We'll follow up via Instagram direct messages.</p>${handleLine}`;
  }
  return `
  <p>Hi ${params.name},</p>
  <p>We've received your request and will get back to you with next steps.</p>
  <p><strong>Request reference:</strong> ${params.requestId.slice(0, 8)}…</p>
  <p><strong>Submitted:</strong> ${params.requestDate}</p>${followUpBlock}
  <p>If you have any urgent follow-up, you can reply to this email.</p>
  <p>— Livable</p>
`;
};

async function sendViaBrevo(params: SendConfirmationParams): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || "Livable";
  const replyTo = process.env.REPLY_TO_EMAIL || fromEmail;
  if (!apiKey || !fromEmail) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: params.to, name: params.name }],
        replyTo: replyTo ? { email: replyTo } : undefined,
        subject: `Livable — We received your request (${params.requestId.slice(0, 8)})`,
        htmlContent: confirmationHtml(params),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Brevo API error:", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Brevo send error:", err);
    return false;
  }
}

async function sendViaOutlook(params: SendConfirmationParams): Promise<boolean> {
  const user = process.env.OUTLOOK_USER;
  const pass = process.env.OUTLOOK_APP_PASSWORD;
  if (!user || !pass) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `Livable <${user}>`,
      to: params.to,
      replyTo: user,
      subject: `Livable — We received your request (${params.requestId.slice(0, 8)})`,
      html: confirmationHtml(params),
    });
    return true;
  } catch (err) {
    console.error("Outlook send error:", err);
    return false;
  }
}

export async function sendConfirmationEmail(params: SendConfirmationParams): Promise<void> {
  const sent = (await sendViaBrevo(params)) || (await sendViaOutlook(params));
  if (!sent) {
    if (!process.env.BREVO_API_KEY && !process.env.OUTLOOK_USER) {
      console.error(
        "Email not sent: set BREVO_API_KEY + FROM_EMAIL (recommended), or OUTLOOK_USER + OUTLOOK_APP_PASSWORD in .env.local"
      );
    }
  }
}

// ----- Zoom link email (sent when admin creates a meeting) -----

export type SendZoomLinkParams = {
  to: string;
  name: string;
  zoomLink: string;
  appointmentDate?: string;
  appointmentTimeSlot?: string;
  rescheduleLink?: string;
  meetingId?: string;
  passcode?: string;
};

function zoomLinkHtml(params: SendZoomLinkParams): string {
  const slotLabel = params.appointmentTimeSlot
    ? getAppointmentSlotLabel(params.appointmentTimeSlot)
    : "";
  const whenLine =
    params.appointmentDate && slotLabel
      ? `<p><strong>When:</strong> ${formatAppointmentDate(params.appointmentDate)}, ${slotLabel}</p>`
      : "";
  const rescheduleBlock = params.rescheduleLink
    ? `<p><strong>Change appointment:</strong><br><a href="${params.rescheduleLink}" style="color: #059669;">${params.rescheduleLink}</a></p>
  <p style="color: #6b7280; font-size: 0.9em;">Please use the link above to cancel or reschedule if you cannot make your appointment or will be more than 10 minutes late.</p>`
    : "";
  return `
  <p>Thank you! Your appointment has been scheduled.</p>

  <p><strong>A few notes:</strong></p>
  <ul style="margin: 0.5em 0; padding-left: 1.25em;">
    <li>Please "arrive" for your virtual appointment on time.</li>
    <li>The meeting link is below — click it when it's time to join.</li>
    <li>If you are more than 10 minutes late for your appointment, we will ask you to reschedule.</li>
    <li>If you cannot make your appointment or will be more than 10 minutes late, please reschedule using the link below.</li>
  </ul>

  <p>We look forward to working with you!</p>

  ${rescheduleBlock}

  <p><strong>Livable is inviting you to a scheduled Zoom meeting.</strong></p>
  <p><strong>Join Zoom Meeting</strong><br><a href="${params.zoomLink}" style="color: #059669; font-weight: 600;">${params.zoomLink}</a></p>
  ${whenLine}

  <p>— Livable</p>
`;
}

async function sendZoomLinkViaBrevo(params: SendZoomLinkParams): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || "Livable";
  const replyTo = process.env.REPLY_TO_EMAIL || fromEmail;
  if (!apiKey || !fromEmail) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: params.to, name: params.name }],
        replyTo: replyTo ? { email: replyTo } : undefined,
        subject: "Livable — Your Zoom appointment link",
        htmlContent: zoomLinkHtml(params),
      }),
    });
    if (!res.ok) {
      console.error("Brevo API error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Brevo send error:", err);
    return false;
  }
}

async function sendZoomLinkViaOutlook(params: SendZoomLinkParams): Promise<boolean> {
  const user = process.env.OUTLOOK_USER;
  const pass = process.env.OUTLOOK_APP_PASSWORD;
  if (!user || !pass) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `Livable <${user}>`,
      to: params.to,
      replyTo: user,
      subject: "Livable — Your Zoom appointment link",
      html: zoomLinkHtml(params),
    });
    return true;
  } catch (err) {
    console.error("Outlook send error:", err);
    return false;
  }
}

export async function sendZoomLinkEmail(params: SendZoomLinkParams): Promise<void> {
  const sent = (await sendZoomLinkViaBrevo(params)) || (await sendZoomLinkViaOutlook(params));
  if (!sent) {
    console.error("Zoom link email not sent: Brevo/Outlook not configured.");
  }
}

// ----- Appointment changed email (after user reschedules) -----

export type SendAppointmentChangedParams = {
  to: string;
  name: string;
  appointmentDate: string;
  appointmentTimeSlot: string;
};

function appointmentChangedHtml(params: SendAppointmentChangedParams): string {
  const slotLabel = getAppointmentSlotLabel(params.appointmentTimeSlot);
  const dateStr = formatAppointmentDate(params.appointmentDate);
  return `
  <p>Hi ${params.name},</p>
  <p>Your appointment has been changed to <strong>${dateStr}, ${slotLabel}</strong>.</p>
  <p>We'll send you a new Zoom link for this time. If you need to change again, use the reschedule link from your last email.</p>
  <p>— Livable</p>
`;
}

async function sendAppointmentChangedViaBrevo(params: SendAppointmentChangedParams): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || "Livable";
  const replyTo = process.env.REPLY_TO_EMAIL || fromEmail;
  if (!apiKey || !fromEmail) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: params.to, name: params.name }],
        replyTo: replyTo ? { email: replyTo } : undefined,
        subject: "Livable — Your appointment has been changed",
        htmlContent: appointmentChangedHtml(params),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendAppointmentChangedViaOutlook(params: SendAppointmentChangedParams): Promise<boolean> {
  const user = process.env.OUTLOOK_USER;
  const pass = process.env.OUTLOOK_APP_PASSWORD;
  if (!user || !pass) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `Livable <${user}>`,
      to: params.to,
      replyTo: user,
      subject: "Livable — Your appointment has been changed",
      html: appointmentChangedHtml(params),
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendAppointmentChangedEmail(params: SendAppointmentChangedParams): Promise<void> {
  const sent =
    (await sendAppointmentChangedViaBrevo(params)) || (await sendAppointmentChangedViaOutlook(params));
  if (!sent) {
    console.error("Appointment changed email not sent: Brevo/Outlook not configured.");
  }
}
