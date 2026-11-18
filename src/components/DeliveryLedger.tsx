import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Search } from 'lucide-react';
import type { ChannelId, DispatchRecord, DocumentCategory } from '../types/cascade';

interface DeliveryLedgerProps {
  dispatches: DispatchRecord[];
  recentlyDeliveredIds?: string[];
  onInspectRecord: (record: DispatchRecord) => void;
  onOpenDocument: (token: string) => void;
  onCreateNew: () => void;
}

function formatFinalChannel(ch: ChannelId | null): string {
  if (ch === 'whatsapp') return 'WhatsApp';
  if (ch === 'rcs') return 'RCS';
  if (ch === 'sms') return 'SMS';
  return 'Pending';
}

function formatCategory(cat: DocumentCategory): string {
  if (cat === 'flight_schedule_update') return 'Schedule Update';
  if (cat === 'visa_application_approved') return 'Visa Approved';
  return 'E-Ticket Issued';
}

export function DeliveryLedger({
  dispatches,
  recentlyDeliveredIds = [],
  onInspectRecord,
  onOpenDocument,
  onCreateNew,
}: DeliveryLedgerProps) {
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | ChannelId>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dispatches.filter((d) => {
      if (channelFilter !== 'all' && d.finalChannel !== channelFilter) {
        return false;
      }
      if (!q) return true;
      return (
        d.passengerName.toLowerCase().includes(q) ||
        d.pnr.toLowerCase().includes(q) ||
        d.to.toLowerCase().includes(q) ||
        d.route.toLowerCase().includes(q) ||
        d.flightNumber.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q)
      );
    });
  }, [dispatches, query, channelFilter]);

  return (
    <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Delivery Ledger & Signed Document Tokens
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Audit trail of every travel e-ticket, schedule update, and visa approval routed through the fallback cascade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PNR, passenger, phone..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 w-56"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(['all', 'whatsapp', 'rcs', 'sms'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setChannelFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  channelFilter === f
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f === 'all' ? 'All' : f === 'whatsapp' ? 'WhatsApp' : f === 'rcs' ? 'RCS' : 'SMS'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700">
            No dispatch records match your current filter.
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
          >
            Create New Dispatch
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50/40">
                <th className="py-2.5 px-4 whitespace-nowrap">Dispatch & Template</th>
                <th className="py-2.5 px-4">Passenger & Phone</th>
                <th className="py-2.5 px-4 whitespace-nowrap">PNR / Ref</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Flight / Route</th>
                <th className="py-2.5 px-4 whitespace-nowrap">SMS Segment</th>
                <th className="py-2.5 px-4">Cascade Result</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtered.map((d) => {
                const pathSummary = d.steps
                  .filter((s) => s.state !== 'skipped' && s.state !== 'pending')
                  .map((s) => `${s.channel.toUpperCase()} (${s.state})`)
                  .join(' → ');

                const finalColor =
                  d.finalChannel === 'whatsapp'
                    ? 'text-emerald-700'
                    : d.finalChannel === 'rcs'
                      ? 'text-teal-700'
                      : d.finalChannel === 'sms'
                        ? 'text-amber-700'
                        : 'text-slate-500';

                const isRecentlyDelivered = recentlyDeliveredIds.includes(d.id);

                return (
                  <tr
                    key={d.id}
                    className={`transition-colors duration-700 ${
                      isRecentlyDelivered
                        ? 'bg-emerald-50/80 hover:bg-emerald-50'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-medium text-slate-800 tabular-nums">
                        {d.id}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatCategory(d.category)} · {d.language.toUpperCase()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{d.passengerName}</div>
                      <div className="text-xs font-mono text-slate-500 tabular-nums">{d.to}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-800 whitespace-nowrap tabular-nums">
                      {d.pnr}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      <div className="font-mono font-medium">{d.flightNumber}</div>
                      <div className="text-slate-500">{d.route}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                      {d.payload.content.sms.encoding} · {d.payload.content.sms.charCount}/
                      {d.payload.content.sms.singleLimit}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${finalColor}`}>
                        {d.status === 'delivered' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        )}
                        <span>Delivered via {formatFinalChannel(d.finalChannel)}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate max-w-[260px]">
                        {pathSummary || 'Processing...'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectRecord(d)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Inspect Trace
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDocument(d.signedToken)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 border border-teal-200 bg-teal-50/50 rounded-md hover:bg-teal-100/60 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>PDF</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
