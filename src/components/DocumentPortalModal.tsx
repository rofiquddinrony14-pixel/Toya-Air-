import { useEffect, useState } from 'react';
import { Download, FileCheck2, Lock, X } from 'lucide-react';

interface DocumentDetails {
  id: string;
  category: string;
  passengerName: string;
  pnr: string;
  route: string;
  departureTime: string;
  airlineOrEmbassy: string;
  to: string;
  pdfFilename: string;
  signedToken: string;
  expiresAt: string;
  finalChannel: string | null;
  downloadUrl: string;
}

interface DocumentPortalModalProps {
  token: string | null;
  onClose: () => void;
}

export function DocumentPortalModal({ token, onClose }: DocumentPortalModalProps) {
  const [doc, setDoc] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/documents/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not verify signed document token.');
        }
        return data.document;
      })
      .then((document) => {
        if (!cancelled) setDoc(document);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load document.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Signed Travel Document Portal"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Tokenized Travel Document Portal
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document portal"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {loading && (
            <div className="py-10 text-center text-sm text-slate-500">
              Verifying signed URL token...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-800">
              {error}
            </div>
          )}

          {doc && !loading && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs font-medium text-teal-700">
                    Toya Air Travels · Verified Document
                  </div>
                  <h4 className="mt-1 text-lg font-semibold text-slate-900">
                    {doc.passengerName}
                  </h4>
                  <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                    {doc.pdfFilename}
                  </div>
                </div>
                <FileCheck2 className="w-6 h-6 text-emerald-700 shrink-0" />
              </div>

              <dl className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-slate-500">PNR / Reference</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                    {doc.pnr}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Route</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{doc.route}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Departure / Issue Date</dt>
                  <dd className="mt-0.5 text-slate-800 tabular-nums">{doc.departureTime}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Carrier / Authority</dt>
                  <dd className="mt-0.5 text-slate-800">{doc.airlineOrEmbassy}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Signed Token</dt>
                  <dd className="mt-0.5 font-mono text-slate-700">{doc.signedToken}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Link Expiry</dt>
                  <dd className="mt-0.5 font-mono text-slate-700 tabular-nums">
                    {new Date(doc.expiresAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>

              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <a
                  href="https://wa.me/8801812222277"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                >
                  Message toyaairbd on WhatsApp
                </a>
                <a
                  href={doc.downloadUrl}
                  download={doc.pdfFilename}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Official PDF</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
