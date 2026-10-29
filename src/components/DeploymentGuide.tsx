import React, { useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  PowerOff,
  Server,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface DeploymentGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentGuide: React.FC<DeploymentGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const cloudRunCmd = `gcloud run deploy btc-signal-monitor \\
  --source . \\
  --region us-central1 \\
  --platform managed \\
  --allow-unauthenticated \\
  --min-instances 1 \\
  --no-cpu-throttling \\
  --memory 512Mi \\
  --cpu 1 \\
  --set-env-vars TELEGRAM_BOT_TOKEN="9198281670:AAH9PPB0bXWr1zmCGT_E9VFAV8jn6vlrGmI",TELEGRAM_CHAT_ID="7719238333",TARGET_URL="https://rollielevel.com/BTC/predictor/",DASHBOARD_PIN="1234"`;

  const dockerComposeCmd = `docker compose up -d --build`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                24/7 Cloud Hosting &amp; "Laptop-Off" Execution Guide
              </h2>
              <p className="text-xs text-slate-400">
                How to keep the monitor active continuously when your computer is closed or shut down
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs text-slate-300">
          {/* Highlight Callout */}
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-300 text-sm">
              <PowerOff className="w-4 h-4 text-indigo-400" />
              <span>Why Your Personal Laptop Stops Monitoring</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              When your laptop is put to sleep or powered off, local timers, browser tabs, and local terminal processes are paused or terminated by the operating system.
              To guarantee that the 5-second confirmation engine monitors every second around the clock, you deploy the containerized backend to an always-on cloud host.
            </p>
          </div>

          {/* Option 1: Google Cloud Run */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-400" />
                Option 1: Google Cloud Run (Fully Managed Container)
              </h3>
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Recommended
              </span>
            </div>
            <p className="leading-relaxed">
              Google Cloud Run runs the Docker container in the cloud. Because this app performs continuous background monitoring, we configure:
              <strong className="text-white"> <code className="text-sky-300">--min-instances 1</code></strong> (prevents container from terminating) and
              <strong className="text-white"> <code className="text-sky-300">--no-cpu-throttling</code></strong> (keeps the 1-second timer ticking outside of HTTP requests).
            </p>

            <div className="relative bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto text-sky-300">
              <pre>{cloudRunCmd}</pre>
              <button
                onClick={() => copyToClipboard(cloudRunCmd, 'cloudrun')}
                className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] flex items-center gap-1.5 transition-colors"
              >
                {copiedCode === 'cloudrun' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5 text-slate-400 text-[11px]">
              <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Cost Estimate:</strong> Cloud Run free tier provides 180,000 vCPU-seconds and 360,000 GiB-seconds monthly. For 1 continuously running 512MB worker, the net monthly cost is approximately $15–$25.
              </span>
            </div>
          </div>

          {/* Option 2: Low Cost VPS with Docker */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Option 2: Budget VPS / Docker Host ($3.50 – $5 / month)
              </h3>
              <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Most Affordable 24/7
              </span>
            </div>
            <p className="leading-relaxed">
              If you want the most affordable continuous monitoring setup, any basic Linux VPS (e.g. Hetzner CX22 for ~€3.79/mo or DigitalOcean Droplet for $4-6/mo) will run this Docker container indefinitely.
            </p>

            <div className="relative bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto text-emerald-400">
              <pre>{`# On your VPS:
git clone <YOUR_REPOSITORY_URL>
cd <APP_DIR>
docker compose up -d --build`}</pre>
              <button
                onClick={() => copyToClipboard('docker compose up -d --build', 'docker')}
                className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] flex items-center gap-1.5 transition-colors"
              >
                {copiedCode === 'docker' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              "Laptop Off" Verification Checklist
            </h3>

            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-sky-400 shrink-0">1</span>
                <div>
                  <strong className="text-white block">Test Telegram Bot Handshake:</strong>
                  <span>Click "Send Test Alert" on this dashboard and ensure you receive the message on Telegram phone app.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-sky-400 shrink-0">2</span>
                <div>
                  <strong className="text-white block">Deploy Container to Cloud Run or VPS:</strong>
                  <span>Run the deployment command above so the service has its own public cloud URL.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-sky-400 shrink-0">3</span>
                <div>
                  <strong className="text-white block">Shut Laptop Lid &amp; Check Phone:</strong>
                  <span>Close your laptop completely. Open your deployed Cloud Run URL on your phone's mobile browser. The status will display RUNNING, and confirmed Telegram alerts will arrive automatically when the conditions trigger.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950/80 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Persistent state is stored in <code className="text-slate-400 font-mono">/data/monitor_state.json</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
