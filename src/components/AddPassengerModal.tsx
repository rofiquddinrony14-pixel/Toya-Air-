import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { SavedContact } from '../types/cascade';

interface AddPassengerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (contact: SavedContact) => void;
}

export function AddPassengerModal({
  open,
  onClose,
  onCreated,
}: AddPassengerModalProps) {
  const [name, setName] = useState('');
  const [bengaliName, setBengaliName] = useState('');
  const [phone, setPhone] = useState('+8801');
  const [recentRoute, setRecentRoute] = useState('DAC-DXB');
  const [recentFlight, setRecentFlight] = useState('BG-147');
  const [recentPnr, setRecentPnr] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bengaliName: bengaliName || name,
          phone,
          recentRoute,
          recentFlight,
          recentPnr,
          whatsappOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save passenger.');
      }
      onCreated(data.contact);
      setName('');
      setBengaliName('');
      setPhone('+8801');
      setRecentRoute('DAC-DXB');
      setRecentFlight('BG-147');
      setRecentPnr('');
      setWhatsappOptIn(true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save passenger.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Saved Passenger"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Add Saved Toya Air Passenger
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Passenger Full Name (English)
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rafiqul Islam"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bengali Name (Optional)
              </label>
              <input
                type="text"
                value={bengaliName}
                onChange={(e) => setBengaliName(e.target.value)}
                placeholder="রফিকুল ইসলাম"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number (E.164)
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801711223344"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Route / Visa Type
              </label>
              <input
                type="text"
                value={recentRoute}
                onChange={(e) => setRecentRoute(e.target.value)}
                placeholder="DAC-DXB"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Flight / Visa Label
              </label>
              <input
                type="text"
                value={recentFlight}
                onChange={(e) => setRecentFlight(e.target.value)}
                placeholder="BG-147"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                PNR / Reference Code
              </label>
              <input
                type="text"
                value={recentPnr}
                onChange={(e) => setRecentPnr(e.target.value)}
                placeholder="99124B (leave blank to auto-generate)"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
          </div>

          <label className="flex items-center justify-between text-xs text-slate-700 pt-1 cursor-pointer">
            <span>WhatsApp Utility Opt-in Enabled</span>
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
          </label>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save & Select Passenger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
