# 🚀 24/7 Cloud Deployment Guide: BTC 5-Minute Prediction Signal Monitor

This application is built to run 24 hours a day, 7 days a week in the cloud. It monitors `https://rollielevel.com/BTC/predictor/`, enforces the **strict 5-second confirmation rule**, prevents duplicate alerts, and sends Telegram notifications directly to your phone.

---

## ⚠️ Crucial Concept: Why Cloud Hosting Is Required

When you close your laptop lid or put it to sleep:
- Your local Wi-Fi disconnects.
- Local processes (Node.js, background tabs, scripts) pause or terminate.
- In-memory timers stop firing.

To monitor continuously **without keeping your laptop on**, the backend must run on an external server or cloud container with an always-allocated CPU.

---

## ☁️ Option 1: Google Cloud Run (Recommended Cloud Deployment)

Google Cloud Run can host containerized apps with near-zero initial setup.

### ⚠️ Critical Setting for Cloud Run: `CPU Always Allocated`
Standard serverless containers sleep when there are no incoming web requests. Because this app does continuous background monitoring every second:
- You **MUST** set **CPU allocation: "CPU is always allocated"** (`--no-cpu-throttling`).
- You **MUST** set **Minimum instances: 1** (`--min-instances 1`).

### Deployment Steps (Google Cloud CLI)

1. **Install and authenticate Google Cloud SDK**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_GCP_PROJECT_ID
   ```

2. **Deploy directly from source**:
   ```bash
   gcloud run deploy btc-signal-monitor \
     --source . \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --min-instances 1 \
     --no-cpu-throttling \
     --memory 512Mi \
     --cpu 1 \
     --set-env-vars TELEGRAM_BOT_TOKEN="9198281670:AAH9PPB0bXWr1zmCGT_E9VFAV8jn6vlrGmI",TELEGRAM_CHAT_ID="7719238333",TARGET_URL="https://rollielevel.com/BTC/predictor/",DASHBOARD_PIN="1234"
   ```

3. **Expected Cost**:
   - Cloud Run provides a monthly free tier (first 180,000 vCPU-seconds and 360,000 GiB-seconds free).
   - With 1 always-on instance (1 vCPU, 512MB RAM), the estimated cost after free tier credits is approximately **$15–$25 per month**.

---

## 🖥️ Option 2: Low-Cost VPS / Virtual Server ($3.50 – $5 / month)

For the most affordable long-term 24/7 background worker:
- **Hetzner Cloud** (CX22 instance, ~€3.79/mo) or
- **DigitalOcean** ($4-6/mo Basic Droplet) or
- **Render.com** (Background Worker, $7/mo)

### 1-Command VPS Setup with Docker:

```bash
# 1. Clone your repo onto the VPS
git clone <YOUR_REPO_URL>
cd <YOUR_REPO_FOLDER>

# 2. Run with Docker Compose
docker compose up -d --build

# 3. Check logs
docker compose logs -f
```
The Docker container restarts automatically if the server reboots (`restart: unless-stopped`).

---

## 📲 Telegram Bot Verification

Your Telegram credentials:
- **Bot Username:** `@BTcpridicion1_bot`
- **Bot Token:** `9198281670:AAH9PPB0bXWr1zmCGT_E9VFAV8jn6vlrGmI`
- **Your Chat ID:** `7719238333`

### How to test:
1. Open your Telegram app and search for `@BTcpridicion1_bot`.
2. Tap **START** or send `/start` so the bot has permission to message you.
3. In the app dashboard, tap **"Send Test Alert"**.
4. You will receive an instant test message confirming the connection.

---

## ✅ Checklist: Verify Notifications Work with Laptop Off

1. Deploy the app to Google Cloud Run (with `--min-instances 1`) or your VPS with Docker.
2. In the dashboard, click **"Simulate Full 5s UP 100%"** to verify that a simulated alert sends to your Telegram.
3. Switch off or close your laptop.
4. From your mobile phone, open the Cloud Run public URL (e.g. `https://your-app.run.app`).
5. Verify the dashboard says **RUNNING** and the live check counter increments every second.
6. Trigger a test from your phone to verify Telegram receives it without your laptop being on!
