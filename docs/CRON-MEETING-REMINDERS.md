# Meeting reminder cron — step-by-step setup

This guide walks you through enabling **automated reminder emails 30 minutes before each Zoom meeting**.

---

## Step 1: Add the database column (Supabase)

The app needs a column to remember that a reminder was already sent (so it doesn’t send twice).

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** → **New query**.
3. Paste and run:

   ```sql
   ALTER TABLE public.requests
   ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
   ```

4. You should see “Success. No rows returned.” (or similar). The column is now there.

If you prefer to run the full schema instead (e.g. for a new project), use the contents of `supabase/schema.sql`; it already includes `reminder_sent_at`.

---

## Step 2: Set environment variables in production

You need two things in the environment where the app runs (e.g. Vercel).

### 2a. `CRON_SECRET`

- **What it is:** A secret string that only your cron job and your app know. It proves the cron request is allowed.
- **How to create it:** Use a long random string (e.g. 32+ characters). You can generate one with:
  - A password generator, or
  - In a terminal: `openssl rand -hex 24`
- **Where to set it:**
  - **Vercel:** Project → **Settings** → **Environment Variables** → Add:
    - **Name:** `CRON_SECRET`
    - **Value:** your generated secret (e.g. `a1b2c3d4e5...`)
    - **Environment:** Production (and Preview if you want to test there)
  - Save. You’ll use the **same value** when configuring the cron job in Step 3.

### 2b. `APP_TIMEZONE` (optional)

- **What it is:** The timezone used for appointment times (e.g. when “9:00” is for the meeting).
- **Default:** `Asia/Seoul` if not set.
- **Where to set it:** Same place as above. Add:
  - **Name:** `APP_TIMEZONE`
  - **Value:** e.g. `Asia/Seoul`
- Only change this if your appointments are in another timezone (e.g. `America/New_York`).

### 2c. Other variables

- Make sure **Brevo** or **Outlook** is configured (so the app can send the reminder email).
- Make sure **APP_URL** is set to your live app URL (e.g. `https://your-app.vercel.app`) so the reminder email’s reschedule link works.

---

## Step 3: Schedule the cron job (call the endpoint every 10–15 minutes)

The app exposes one endpoint that:

- Finds Zoom meetings that start in about 25–35 minutes.
- Sends a reminder email for each.
- Marks them so it doesn’t send again.

You must call this endpoint **every 10–15 minutes** and send the secret in a header. Two ways to do that:

---

### Option A: cron-job.org (recommended, works with Vercel)

This free service can call your URL on a schedule and send a custom header.

1. **Sign up**
   - Go to [cron-job.org](https://cron-job.org) and create an account (free).

2. **Create a new cron job**
   - Click **Cronjobs** → **Create cronjob** (or **Create**).

3. **URL**
   - **Title:** e.g. `Livable meeting reminders`
   - **Address (URL):**  
     `https://YOUR-APP-URL/api/cron/meeting-reminders`  
     Replace `YOUR-APP-URL` with your real app URL, e.g. `https://livable-xxx.vercel.app` (no trailing slash).

4. **Schedule**
   - Set **Interval** to **Every 10 minutes** (or **Every 15 minutes**).  
   - This makes sure a meeting that’s “30 minutes from now” is picked up by at least one run.

5. **Request method**
   - **Request method:** **GET** (default is often GET; confirm it’s GET).

6. **Custom header (the secret)**
   - Find the section for **Request headers** or **Advanced** / **Headers**.
   - Add one header:
     - **Name:** `x-cron-secret`
     - **Value:** the **exact same** value you set for `CRON_SECRET` in Vercel (Step 2a).

7. **Save**
   - Save the cron job. It will start running on the schedule you set.

8. **Test once**
   - Use **Execute now** (or similar) to trigger one run. Then:
     - Check the response (e.g. `{"ok":true,"sent":0,"total":0}` if there were no meetings in the 25–35 min window).
     - If you get `401 Unauthorized`, the header name or value doesn’t match `CRON_SECRET`.

---

### Option B: Another cron service that supports custom headers

If you use a different provider (e.g. EasyCron, cron-job.one, or a small server):

1. **Schedule:** Every 10 or 15 minutes.
2. **Request:** **GET** `https://YOUR-APP-URL/api/cron/meeting-reminders`
3. **Header:** Add:
   - **Name:** `x-cron-secret`
   - **Value:** your `CRON_SECRET` value (same as in Vercel).

Same idea as Option A; only the UI of your cron service changes.

---

### Why not “Vercel Cron” alone?

Vercel’s built-in Cron (in `vercel.json`) can hit a URL on a schedule, but **it does not send your `CRON_SECRET`** in the request. So if you point Vercel Cron directly at `/api/cron/meeting-reminders`, the app would reject the request (no secret). To keep the endpoint secure, it **requires** the `x-cron-secret` header. So you have two choices:

- **Use an external cron** (e.g. cron-job.org) that sends the header — recommended; no code changes.
- **Use Vercel Cron plus a proxy:** you’d add another route that Vercel Cron calls, which then calls `/api/cron/meeting-reminders` with the header from `process.env.CRON_SECRET`. That’s more code and still needs the cron schedule in Vercel; the steps above avoid that.

---

## Step 4: Confirm APP_TIMEZONE (optional)

- If you didn’t set `APP_TIMEZONE`, the app uses **Asia/Seoul**.
- If your appointments are in another timezone, set `APP_TIMEZONE` in the same place as `CRON_SECRET` (e.g. Vercel Environment Variables) to the correct IANA name (e.g. `America/New_York`).

No other steps are required for timezone; the app uses this for “30 minutes before” already.

---

## Quick checklist

- [ ] **Supabase:** `reminder_sent_at` column added (Step 1).
- [ ] **Vercel (or your host):** `CRON_SECRET` set; optionally `APP_TIMEZONE` and `APP_URL` (Step 2).
- [ ] **Cron job:** Runs every 10–15 minutes, GET `https://YOUR-APP-URL/api/cron/meeting-reminders` with header `x-cron-secret: YOUR_CRON_SECRET` (Step 3).
- [ ] **Test:** Trigger the cron once and check response (and logs if needed).

After this, reminders are sent automatically about 30 minutes before each Zoom meeting. If a user reschedules, a new reminder is sent for the new time once a new Zoom link exists.
