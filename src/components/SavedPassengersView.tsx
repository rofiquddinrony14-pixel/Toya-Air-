import { useMemo, useState } from 'react';
import { MessageCircle, Search, Send, UserPlus } from 'lucide-react';
import type { SavedContact } from '../types/cascade';

interface SavedPassengersViewProps {
  contacts: SavedContact[];
  onAddPassenger: () => void;
  onDispatchToPassenger: (contact: SavedContact) => void;
  onOpenDeskForPassenger: (contact: SavedContact) => void;
}

export function SavedPassengersView({
  contacts,
  onAddPassenger,
  onDispatchToPassenger,
  onOpenDeskForPassenger,
}: SavedPassengersViewProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.bengaliName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.recentPnr.toLowerCase().includes(q) ||
        c.recentRoute.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  return (
    <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Saved Toya Air Passengers
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Frequent flyers and visa applicants stored for one-click cascade dispatch and Travel Desk context.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, PNR..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 w-56"
            />
          </div>

          <button
            type="button"
            onClick={onAddPassenger}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add New Passenger</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700">
            No saved passengers match your search.
          </p>
          <button
            type="button"
            onClick={onAddPassenger}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
          >
            Add New Passenger
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50/40">
                <th className="py-2.5 px-4">Passenger</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Phone (E.164)</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Recent PNR / Ref</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Flight / Route</th>
                <th className="py-2.5 px-4 whitespace-nowrap">WhatsApp Opt-in</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.bengaliName}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                    {c.phone}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-medium text-slate-800 tabular-nums whitespace-nowrap">
                    {c.recentPnr}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                    <span className="font-mono font-medium">{c.recentFlight}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span>{c.recentRoute}</span>
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap">
                    <span
                      className={
                        c.whatsappOptIn
                          ? 'font-semibold text-emerald-700'
                          : 'font-medium text-slate-500'
                      }
                    >
                      {c.whatsappOptIn ? 'Opted In' : 'SMS / RCS Only'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenDeskForPassenger(c)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Travel Desk</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDispatchToPassenger(c)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-teal-800 border border-teal-200 bg-teal-50/60 rounded-md hover:bg-teal-100/70 transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
