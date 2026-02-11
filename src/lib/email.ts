/**
 * Send confirmation email via Brevo API or Outlook SMTP.
 * Use Brevo if your Outlook has "SmtpClientAuthentication is disabled" (free tier, no SMTP needed).
 */
import nodemailer from "nodemailer";

export type SendConfirmationParams = {
  to: string;
  name: string;
  requestId: string;
  requestDate: string;
};

const confirmationHtml = (params: SendConfirmationParams) => `
  <p>Hi ${params.name},</p>
  <p>We've received your request and will get back to you with next steps.</p>
  <p><strong>Request reference:</strong> ${params.requestId.slice(0, 8)}…</p>
  <p><strong>Submitted:</strong> ${params.requestDate}</p>
  <p>If you have any urgent follow-up, you can reply to this email.</p>
  <p>— Livable</p>
`;

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
