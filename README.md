# Livable

A small help portal for foreigners living in Korea. Users submit requests; you manage them and follow up by email.

## What?s included

- **Landing page** (`/`) ? intro and link to the request form
- **Request form** (`/request`) ? name, email, phone, language, category, message
- **Submit API** — saves to Supabase and sends a confirmation email (via Brevo or Outlook)
- **Admin** (`/admin`) — list of requests (protected by `ADMIN_SECRET`)

## Security and data protection

The app is built to keep user data safe and to avoid common abuse:

- **Admin access** — Admin APIs accept only the `x-admin-secret` header (never the URL). The secret is not linked anywhere on the public site.
- **Input validation** — All submitted fields have maximum lengths; email format is validated. Request body size is capped (~50KB).
- **Rate limiting** — Submit endpoint is limited to 5 requests per IP per 15 minutes to reduce spam and abuse.
- **Security headers** — Responses send `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and similar headers to reduce clickjacking and sniffing.
- **Database** — Supabase RLS is enabled; the app uses the service role only on the server for admin and for validated form submissions. No secrets or service keys are exposed to the browser.
- **Errors** — In production, API error messages do not expose internal details (e.g. DB errors are logged server-side only).

User data (name, email, phone, message) is only used to respond to the request and is not shared with third parties or used for marketing (as stated on the About page).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the script in `supabase/schema.sql`.
3. In Project Settings → API, copy the **Project URL**, **anon public** key, and **service_role** key (use service_role only in server env; never expose to the client).

### 3. Confirmation email (Brevo — use this if Outlook SMTP is disabled)

If you see *"SmtpClientAuthentication is disabled for the Mailbox"* with Outlook, use **Brevo** instead (free tier, no SMTP):

1. Sign up at [brevo.com](https://www.brevo.com) and go to **SMTP & API** → **API Keys**. Create an API key and copy it.
2. Go to **Senders & IP** → **Senders**. Add a sender: your email (e.g. your Outlook address) and name (e.g. "Livable"). Brevo will send a verification link to that email; click it to verify.
3. In `.env.local` set:
   - `BREVO_API_KEY=xkeysib-your-key`
   - `FROM_EMAIL=yourname@outlook.com` (the verified sender email)
   - `FROM_NAME=Livable`
   - `REPLY_TO_EMAIL=yourname@outlook.com` (so replies go to you)

Emails are sent via Brevo’s API; your Outlook is only used as the verified “from” address, so Outlook SMTP does not need to be enabled.

### 4. Environment variables

Copy `.env.example` to `.env.local` and fill in Supabase keys, Brevo (or Outlook), and `ADMIN_SECRET`.

**Optional — Discord:** To get a notification in a Discord channel when someone submits a request, create a webhook (Server Settings → Integrations → Webhooks → New Webhook), copy the URL, and set `DISCORD_WEBHOOK_URL` in `.env.local`. The message includes name, email, phone (if provided), category, and description.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Submit a request from `/request`, then open `/admin` and enter your `ADMIN_SECRET` to see it.

## Testing the flow

You don’t need an admin account to submit a request. Submissions are anonymous.

1. **Submit a request (as a “user”)**  
   Go to [http://localhost:3000/request](http://localhost:3000/request). Fill in name, email, category, message, etc. and submit. Use your own email so you receive the confirmation. Data is stored in Supabase and a confirmation email is sent (via Brevo or Outlook).

2. **View and resolve in Admin**  
   Go to [http://localhost:3000/admin](http://localhost:3000/admin). Enter your `ADMIN_SECRET` and click **Load**. You’ll see all requests. Click a request to open its **detail page**: full message, contact info, and timestamps. There you can:
   - Change **Status** (New → In progress → Resolved / Closed)
   - Add **Internal notes** (only visible to you)
   - Click **Save** to store changes in the database.

3. **Verify in Supabase (optional)**  
   In the Supabase dashboard, open **Table Editor** → `requests`. You’ll see the same rows; editing there also updates the data the app uses.

## Publish to the web

To share a real URL (instead of localhost), deploy to **Vercel** (free tier). You’ll get a link like `https://livable-xxx.vercel.app` to share.

### 1. Put your code on GitHub

If you haven’t already:

- Create a repo at [github.com/new](https://github.com/new) (e.g. `Livable`).
- In your project folder, run:
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/Livable.git
  git push -u origin main
  ```
  (Replace `YOUR_USERNAME` with your GitHub username.)

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New** → **Project** and **import** your `Livable` repo.
3. Leave **Framework Preset** as Next.js and **Root Directory** as `.`. Click **Deploy** (first deploy may use default env).
4. After the first deploy, go to **Project** → **Settings** → **Environment Variables**. Add the same variables you have in `.env.local` (do **not** commit `.env.local` to Git):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |
   | `BREVO_API_KEY` | your Brevo API key |
   | `FROM_EMAIL` | sender email (e.g. your Outlook) |
   | `FROM_NAME` | Livable |
   | `REPLY_TO_EMAIL` | same as FROM_EMAIL or your reply address |
   | `ADMIN_SECRET` | your secret for /admin |
   | `DISCORD_WEBHOOK_URL` | (optional) Discord webhook for new-request notifications |

5. Click **Save**, then go to **Deployments** → open the **⋯** on the latest deployment → **Redeploy** so the new env vars are used.

Your app will be live at `https://your-project-name.vercel.app`. Share that link so people can open the site and submit requests. Use `/admin` and your `ADMIN_SECRET` to manage requests.

### 3. Optional: custom domain

In Vercel: **Project** → **Settings** → **Domains** → add a domain you own (e.g. `livable.example.com`). Follow the DNS instructions Vercel shows.

## Next steps

- Add “Send follow-up email” from the request detail page (email the requester when you update status).
- Add auth for admin (e.g. Supabase Auth or NextAuth) and drop the shared secret.
