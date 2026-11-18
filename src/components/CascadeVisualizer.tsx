import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  SkipForward,
  XCircle,
} from 'lucide-react';
import type { CascadeStepLog, DispatchRecord, StepState } from '../types/cascade';

interface CascadeVisualizerProps {
  record: DispatchRecord;
}

function getStepStatusMeta(state: StepState) {
  switch (state) {
    case 'delivered':
      return {
        label: 'Delivered',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200 bg-emerald-50/40',
        Icon: CheckCircle2,
      };
    case 'checking':
    case 'awaiting_ack':
      return {
        label: state === 'checking' ? 'Checking Capability' : 'Awaiting ACK',
        textClass: 'text-teal-700',
        borderClass: 'border-teal-200 bg-teal-50/40',
        Icon: Loader2,
      };
    case 'timeout':
    case 'cancelled':
      return {
        label: state === 'timeout' ? 'Timed Out' : 'Cancelled',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200 bg-amber-50/40',
        Icon: Clock,
      };
    case 'unsupported':
      return {
        label: 'Unsupported',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200 bg-rose-50/40',
        Icon: XCircle,
      };
    case 'skipped':
      return {
        label: 'Skipped',
        textClass: 'text-slate-400',
        borderClass: 'border-slate-200 bg-slate-50/60',
        Icon: SkipForward,
      };
    default:
      return {
        label: 'Queued',
        textClass: 'text-slate-500',
        borderClass: 'border-slate-200 bg-white',
        Icon: AlertTriangle,
      };
  }
}

function formatChannelLabel(channel: CascadeStepLog['channel']): string {
  if (channel === 'whatsapp') return 'Priority 1 · WhatsApp Utility';
  if (channel === 'rcs') return 'Priority 2 · RCS Rich Card';
  return 'Priority 3 · SMS Safety Net';
}

export function CascadeVisualizer({ record }: CascadeVisualizerProps) {
  const [tab, setTab] = useState<'trace' | 'json' | 'curl'>('trace');
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(record.payload, null, 2);
  const curlString = `curl -X POST https://api.toyaairbd.com/v1/dispatch \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(record.payload)}'`;

  const handleCopy = async () => {
    const text = tab === 'curl' ? curlString : jsonString;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/70">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="font-mono tabular-nums">{record.id}</span>
            <span className="text-slate-300">/</span>
            <span className="truncate">{record.passengerName}</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2 tabular-nums">
            <span>PNR {record.pnr}</span>
            <span aria-hidden="true">·</span>
            <span>{record.route}</span>
            <span aria-hidden="true">·</span>
            <span>Timeout {record.fallbackTimeoutSeconds}s</span>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setTab('trace')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'trace'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cascade Trace
          </button>
          <button
            type="button"
            onClick={() => setTab('json')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'json'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Unified JSON
          </button>
          <button
            type="button"
            onClick={() => setTab('curl')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'curl'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            cURL
          </button>
        </div>
      </div>

      {tab === 'trace' && (
        <div className="p-4 space-y-2.5">
          {record.steps.map((step, index) => {
            const meta = getStepStatusMeta(step.state);
            const Icon = meta.Icon;
            const isSpinning = step.state === 'checking' || step.state === 'awaiting_ack';
            return (
              <div key={step.channel}>
                <div
                  className={`rounded-lg border p-3.5 transition-colors ${meta.borderClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${meta.textClass} ${
                          isSpinning ? 'animate-spin' : ''
                        }`}
                      />
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {formatChannelLabel(step.channel)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-xs tabular-nums">
                      {step.durationMs > 0 && (
                        <span className="font-mono text-slate-500">
                          {(step.durationMs / 1000).toFixed(2)}s
                        </span>
                      )}
                      <span className={`font-semibold ${meta.textClass}`}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed pl-6">
                    {step.detail}
                  </p>
                </div>

                {index < record.steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(tab === 'json' || tab === 'curl') && (
        <div className="relative">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
            <span className="font-mono">
              {tab === 'json' ? 'POST /api/dispatch · application/json' : 'cURL Dispatch Example'}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="p-4 bg-slate-950 text-slate-200 text-xs font-mono leading-relaxed overflow-x-auto max-h-[380px]">
            <code>{tab === 'json' ? jsonString : curlString}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
