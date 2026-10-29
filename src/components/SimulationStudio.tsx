import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  XCircle,
  TrendingUp,
  TrendingDown,
  Code2,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  RotateCcw,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface SimulationStudioProps {
  isSimulationActive: boolean;
  onTriggerSimulation: (type: any) => void;
  onStopSimulation: () => void;
  isActionLoading: boolean;
}

export const SimulationStudio: React.FC<SimulationStudioProps> = ({
  isSimulationActive,
  onTriggerSimulation,
  onStopSimulation,
  isActionLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'html-tester'>('scenarios');
  const [testHtml, setTestHtml] = useState<string>(
    `<section class="win-card" id="card-now">
  <h2>Now: current window</h2>
  <div class="small" id="now-window-range">12:30 PM – 12:35 PM</div>
  <div class="countdown" id="now-countdown">02:18</div>
  <div>
    <span class="price" id="now-price">$80,171.82</span>
    <span id="now-delta" class="small delta-down"> ▼ 28.18 (-0.04%)</span>
  </div>
  <div class="pred">
    <div class="arrow up" id="now-arrow">▲</div>
    <div>
      <div class="conf-label">Model says</div>
      <div class="conf-val" id="now-conf">UP · 100.0%</div>
      <div class="small" id="now-explain">Confidence 100% · based on momentum vs realised volatility</div>
    </div>
  </div>
  <a class="market-link" id="now-market-link" href="https://polymarket.com/event/btc-updown-5m-1793277000">Open market</a>
</section>
<section class="win-card" id="card-next">
  <h2>Next window</h2>
  <div class="conf-val" id="next-conf">DOWN · 80.0%</div>
</section>`
  );
  const [extractResult, setExtractResult] = useState<any | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleTestHtml = async () => {
    setIsExtracting(true);
    try {
      const res = await fetch('/api/extract-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: testHtml }),
      });
      const data = await res.json();
      setExtractResult(data);
    } catch (err: any) {
      setExtractResult({ success: false, error: err.message });
    } finally {
      setIsExtracting(false);
    }
  };

  const scenarios = [
    {
      id: 'scenario-1-up-success',
      title: '1. UP 100% (>5s)',
      expected: '1 Alert Sent',
      description: 'UP 100% held for >5s -> 5-second stopwatch completes, Telegram alert dispatched.',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    {
      id: 'scenario-2-drop-at-3s',
      title: '2. Drop at 3.0s (95%)',
      expected: 'Canceled (0 Alerts)',
      description: 'UP 100% for 3s then drops to 95% -> Timer instantly resets to 0, no alert sent.',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    {
      id: 'scenario-3-flip-down-before-5s',
      title: '3. Flipped to DOWN',
      expected: 'Canceled (0 UP Alerts)',
      description: 'UP 100% for 2.5s then direction flips to DOWN -> Timer cancels, no UP alert.',
      badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      icon: <TrendingDown className="w-3.5 h-3.5" />,
    },
    {
      id: 'scenario-4-same-window-repeat',
      title: '4. Same Window Repeat',
      expected: 'Blocked (1 Alert Max)',
      description: 'Window already alerted. Qualifying signal returns in same window -> Blocked as duplicate.',
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      icon: <Lock className="w-3.5 h-3.5" />,
    },
    {
      id: 'scenario-5-next-window-permitted',
      title: '5. Next 5m Window',
      expected: 'Permitted (1 Alert)',
      description: 'New 5-minute window timestamp arrives -> Monitored independently, 1 alert permitted.',
      badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      id: 'scenario-6-restart-dedup',
      title: '6. Server Restart Test',
      expected: 'Persistent Lock',
      description: 'Verifies alerted window ID survives backend restarts in persistent storage.',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: <RotateCcw className="w-3.5 h-3.5" />,
    },
    {
      id: 'scenario-7-extraction-fail',
      title: '7. Stale / Missing Data',
      expected: 'Error / No Alert',
      description: 'Simulates unreadable confidence or stale data -> Shows ERROR, no live alert.',
      badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    {
      id: 'scenario-8-under-210-blocked',
      title: '8. Timer < 2:10 Cutoff',
      expected: 'Blocked (0 Alerts)',
      description: 'UP 100% when timer is 01:45 (< 2:10 cutoff) -> No alert sent even with 100% confidence!',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-indigo-500/20 text-indigo-400">
            <FlaskConical className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Verification Studio: 8 Test Scenarios
          </h2>
          {isSimulationActive && (
            <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
              🧪 SCENARIO TEST IN PROGRESS
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'scenarios'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All 8 Test Scenarios
          </button>
          <button
            onClick={() => setActiveTab('html-tester')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'html-tester'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DOM &amp; HTML Inspector
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'scenarios' ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Run and verify each of the 8 required scenarios to confirm the 5-second continuous confirmation, 2:10 countdown cutoff, and 1-alert-per-5-minute-window rule before live trading:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {scenarios.map((sc) => (
                <div
                  key={sc.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        {sc.icon}
                        {sc.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${sc.badgeColor}`}
                      >
                        {sc.expected}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                      {sc.description}
                    </p>
                  </div>

                  <button
                    onClick={() => onTriggerSimulation(sc.id)}
                    disabled={isActionLoading}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-750 hover:text-white border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-sky-400" />
                    <span>Run Scenario Test</span>
                  </button>
                </div>
              ))}
            </div>

            {isSimulationActive && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={onStopSimulation}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Stop Active Scenario &amp; Return to Live Feed</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Verify how the extractor parses the exact <strong>#card-now</strong> markup, confidence, window ID, and strictly ignores <strong>#card-next</strong>.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Test DOM HTML (Now: Current Window):
                </label>
                <textarea
                  value={testHtml}
                  onChange={(e) => setTestHtml(e.target.value)}
                  rows={9}
                  className="w-full p-3 bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  onClick={handleTestHtml}
                  disabled={isExtracting}
                  className="mt-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Code2 className="w-4 h-4" />
                  <span>{isExtracting ? 'Parsing...' : 'Run Parser on Markup'}</span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Parsed Output &amp; Selectors Verified:
                </label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 min-h-[210px] overflow-auto">
                  {extractResult ? (
                    <div>
                      {extractResult.success ? (
                        <div className="space-y-2 text-emerald-400">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Signal Successfully Parsed from #card-now:</span>
                          </div>
                          <div className="text-slate-300 space-y-1.5 pl-4 border-l-2 border-emerald-500/40 text-xs">
                            <div>Direction: <strong className="text-white">{extractResult.signal?.direction}</strong></div>
                            <div>Confidence: <strong className="text-white">{extractResult.signal?.confidence}%</strong></div>
                            <div>Unique Window ID: <strong className="text-white">{extractResult.signal?.windowId}</strong></div>
                            <div>Window Start/End: <strong className="text-white">{extractResult.signal?.windowStartEnd}</strong></div>
                            <div>Reference Price: <strong className="text-white">{extractResult.signal?.referencePrice}</strong></div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-rose-400 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <XCircle className="w-4 h-4" />
                            <span>Parsing Rejected:</span>
                          </div>
                          <div className="text-slate-300 pl-4">{extractResult.error}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-600">Click "Run Parser on Markup" to inspect.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
