import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Plane,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  DispatchRecord,
  DocumentCategory,
  ExtractedDocumentInfo,
  SavedContact,
  TemplateLanguage,
} from './types/cascade';
import { AddPassengerModal } from './components/AddPassengerModal';
import { ArchitectureMatrix } from './components/ArchitectureMatrix';
import { DeliveryLedger } from './components/DeliveryLedger';
import { DispatchWorkbench, type DispatchDraft } from './components/DispatchWorkbench';
import { DocumentPortalModal } from './components/DocumentPortalModal';
import { SavedPassengersView } from './components/SavedPassengersView';
import { ToyaTravelDesk } from './components/ToyaTravelDesk';

type ViewTab = 'workbench' | 'ledger' | 'passengers' | 'architecture' | 'desk';

const INITIAL_DRAFT: DispatchDraft = {
  category: 'flight_eticket_issued',
  language: 'en',
  smsLanguage: 'en',
  passengerName: 'Tariqul Islam',
  pnr: '88492A',
  flightNumber: 'BG-147',
  route: 'DAC-DXB',
  departureTime: '24 Nov 10:30AM',
  previousTime: '09:45PM',
  visaStatus: 'Approved',
  validityRemarks: 'Valid till 18 Jan 27',
  airlineOrEmbassy: 'Biman Bangladesh · BG-147',
  to: '+8801700000000',
  fallbackTimeoutSeconds: 20,
  acceleratedDemo: true,
  conditions: {
    whatsappActive: true,
    dataConnected: true,
    rcsSupported: true,
    smsReachable: true,
    simulateWhatsAppTimeout: false,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>('workbench');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [activeRecordId, setActiveRecordId] = useState<string>('DSP-88492A');
  const [draft, setDraft] = useState<DispatchDraft>(INITIAL_DRAFT);
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [addPassengerOpen, setAddPassengerOpen] = useState(false);
  const [deskPrompt, setDeskPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [deliveryToast, setDeliveryToast] = useState<DispatchRecord | null>(null);
  const [recentlyDeliveredIds, setRecentlyDeliveredIds] = useState<string[]>([]);
  const celebratedIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const passengerInputRef = useRef<HTMLInputElement | null>(null);

  const loadInitialData = async (isManualSync = false) => {
    if (isManualSync) setSyncing(true);
    try {
      const [dispRes, contRes] = await Promise.all([
        fetch('/api/dispatches'),
        fetch('/api/contacts'),
      ]);
      const dispData = await dispRes.json();
      const contData = await contRes.json();
      const list: DispatchRecord[] = dispData.dispatches ?? [];
      setDispatches(list);
      setContacts(contData.contacts ?? []);
      if (list.length > 0 && !list.some((item) => item.id === activeRecordId)) {
        setActiveRecordId(list[0].id);
      }
      setLastSyncedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    const match = window.location.pathname.match(/^\/t\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) {
      setPortalToken(match[1]);
    }
  }, []);

  const activeRecord =
    dispatches.find((d) => d.id === activeRecordId) ?? dispatches[0];

  const inProgressIds = dispatches
    .filter((d) => d.status === 'in_progress')
    .map((d) => d.id);

  useEffect(() => {
    if (inProgressIds.length === 0) {
      return;
    }
    const interval = setInterval(async () => {
      for (const id of inProgressIds) {
        try {
          const res = await fetch(`/api/dispatches/${id}`);
          if (!res.ok) continue;
          const data = await res.json();
          const updated: DispatchRecord = data.dispatch;

          setDispatches((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );

          if (
            updated.status === 'delivered' &&
            !celebratedIdsRef.current.has(updated.id)
          ) {
            celebratedIdsRef.current.add(updated.id);
            setDeliveryToast(updated);
            setRecentlyDeliveredIds((prev) =>
              prev.includes(updated.id) ? prev : [...prev, updated.id]
            );

            if (toastTimerRef.current) {
              window.clearTimeout(toastTimerRef.current);
            }
            toastTimerRef.current = window.setTimeout(() => {
              setDeliveryToast(null);
            }, 5000);

            window.setTimeout(() => {
              setRecentlyDeliveredIds((prev) =>
                prev.filter((itemId) => itemId !== updated.id)
              );
            }, 4000);
          }
        } catch {
          // Retry on next interval
        }
      }
    }, 350);

    return () => clearInterval(interval);
  }, [inProgressIds.join(',')]);

  const handleDispatchCreated = (created: DispatchRecord) => {
    setDispatches((prev) => [created, ...prev]);
    setActiveRecordId(created.id);
  };

  const handleStartNewDispatch = () => {
    setActiveTab('workbench');
    window.setTimeout(() => {
      passengerInputRef.current?.focus();
      passengerInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handlePassengerCreated = (contact: SavedContact) => {
    setContacts((prev) => [contact, ...prev]);
    const isVisa = contact.recentPnr.startsWith('VISA');
    setDraft({
      ...draft,
      category: isVisa ? 'visa_application_approved' : 'flight_eticket_issued',
      passengerName: contact.name,
      to: contact.phone,
      route: contact.recentRoute,
      flightNumber: contact.recentFlight,
      pnr: contact.recentPnr,
    });
  };

  const handleDispatchToPassenger = (contact: SavedContact) => {
    const isVisa = contact.recentPnr.startsWith('VISA');
    setDraft({
      ...draft,
      category: isVisa ? 'visa_application_approved' : 'flight_eticket_issued',
      passengerName: contact.name,
      to: contact.phone,
      route: contact.recentRoute,
      flightNumber: contact.recentFlight,
      pnr: contact.recentPnr,
    });
    setActiveTab('workbench');
  };

  const handleLoadTemplateSample = (
    template: DocumentCategory,
    language: TemplateLanguage = 'en'
  ) => {
    if (template === 'flight_schedule_update') {
      setDraft({
        ...INITIAL_DRAFT,
        category: 'flight_schedule_update',
        language,
        passengerName: 'Sajjad Hossain',
        pnr: '77219K',
        flightNumber: 'EK-585',
        route: 'DAC-DXB',
        previousTime: '09:45PM',
        departureTime: '28 Nov 11:30PM',
        airlineOrEmbassy: 'Emirates · EK-585',
        to: '+8801713476408',
        fallbackTimeoutSeconds: 10,
      });
    } else if (template === 'visa_application_approved') {
      setDraft({
        ...INITIAL_DRAFT,
        category: 'visa_application_approved',
        language,
        passengerName: 'Mahmudul Hasan',
        pnr: 'VISA-2026-9041',
        flightNumber: 'UAE Visa',
        route: 'UAE Tourist',
        departureTime: '18 Jan 27',
        visaStatus: 'Approved',
        validityRemarks: 'Valid till 18 Jan 27',
        airlineOrEmbassy: 'UAE ICP Immigration Authority',
        to: '+8801911778899',
        fallbackTimeoutSeconds: 15,
      });
    } else {
      setDraft({
        ...INITIAL_DRAFT,
        language,
      });
    }
    setActiveTab('workbench');
  };

  const handleLoadExtractedToDispatcher = (
    info: ExtractedDocumentInfo,
    phone?: string
  ) => {
    setDraft({
      ...draft,
      category:
        info.documentType === 'visa_approval'
          ? 'visa_application_approved'
          : 'flight_eticket_issued',
      passengerName: info.passengerName || draft.passengerName,
      pnr: info.referenceNumber || draft.pnr,
      flightNumber: info.flightNumber || draft.flightNumber,
      route: info.route || draft.route,
      departureTime: info.travelDate || draft.departureTime,
      airlineOrEmbassy: info.airlineOrAuthority || draft.airlineOrEmbassy,
      to: phone || draft.to,
    });
    setActiveTab('workbench');
  };

  const deliveredViaWa = dispatches.filter(
    (d) => d.finalChannel === 'whatsapp'
  ).length;
  const deliveredViaRcs = dispatches.filter(
    (d) => d.finalChannel === 'rcs'
  ).length;
  const deliveredViaSms = dispatches.filter(
    (d) => d.finalChannel === 'sms'
  ).length;

  const navItems: Array<{
    id: ViewTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    { id: 'workbench', label: 'Overview & Dispatch', icon: LayoutDashboard },
    { id: 'ledger', label: 'Dispatch Logs', icon: History, count: dispatches.length },
    { id: 'passengers', label: 'Saved Passengers', icon: Users, count: contacts.length },
    { id: 'architecture', label: 'Unified Templates', icon: FileText },
    { id: 'desk', label: 'Toya Travel Desk', icon: MessageCircle },
  ];

  const sectionTitle =
    navItems.find((n) => n.id === activeTab)?.label ?? 'Overview & Dispatch';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[260px] lg:shrink-0 border-r border-slate-200 bg-white">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
            <Plane className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-slate-900 whitespace-nowrap">
            Toya Air Dispatch
          </span>
        </div>

        <nav className="p-3 space-y-1 border-b border-slate-200">
          <div className="px-3 pb-1 text-xs font-medium text-slate-400">
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-teal-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-b border-slate-200 space-y-2.5">
          <div className="text-xs font-medium text-slate-400">
            Cascade Priority
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span>WhatsApp Utility</span>
              <span className="font-mono text-emerald-700 font-medium">Tier 1</span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>RCS Fallback</span>
              <span className="font-mono text-teal-700 font-medium">Tier 2</span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>SMS Safety Net</span>
              <span className="font-mono text-amber-700 font-medium">Tier 3</span>
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 text-xs text-slate-500 space-y-1.5">
          <div className="font-semibold text-slate-800">Toya Air Travels</div>
          <div>Katiadi Bazar, Kishoreganj</div>
          <div className="font-mono tabular-nums">+8801812222277 · +8801713476408</div>
          <a
            href="https://wa.me/8801812222277"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-emerald-700 hover:text-emerald-800 font-medium underline underline-offset-2 pt-0.5"
          >
            Message toyaairbd on WhatsApp
          </a>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-50 w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="font-display font-bold text-base text-slate-900">
                Toya Air Dispatch
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-teal-50 text-teal-900'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                Cascade Dispatch
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {sectionTitle}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartNewDispatch}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>New Cascade Dispatch</span>
          </button>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1380px] w-full mx-auto space-y-6">
          {/* Overview Banner & Summary Strip */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-semibold text-slate-900">
                  Document Dispatch Overview
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-channel routing cascade across WhatsApp Utility, RCS Rich Cards, and GSM-7 SMS.
                  {lastSyncedAt ? ` · Synced ${lastSyncedAt}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadInitialData(true)}
                disabled={syncing}
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-3.5 py-2 rounded-lg border border-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-slate-500 ${syncing ? 'animate-spin' : ''}`}
                />
                <span>{syncing ? 'Syncing...' : 'Sync Status'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 bg-white rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              <div className="p-4 sm:px-5">
                <div className="text-xs text-slate-500">Total Document Dispatches</div>
                <div className="mt-1 text-2xl font-display font-bold text-slate-900 tabular-nums">
                  {dispatches.length}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Tickets, schedule alerts & visas
                </div>
              </div>
              <div className="p-4 sm:px-5">
                <div className="text-xs text-slate-500">Priority 1 · WhatsApp</div>
                <div className="mt-1 text-2xl font-display font-bold text-emerald-700 tabular-nums">
                  {deliveredViaWa}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Utility templates with inline PDF
                </div>
              </div>
              <div className="p-4 sm:px-5">
                <div className="text-xs text-slate-500">Priority 2 · RCS Fallback</div>
                <div className="mt-1 text-2xl font-display font-bold text-teal-700 tabular-nums">
                  {deliveredViaRcs}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Rich card + postback + dial desk
                </div>
              </div>
              <div className="p-4 sm:px-5">
                <div className="text-xs text-slate-500">Priority 3 · SMS Safety Net</div>
                <div className="mt-1 text-2xl font-display font-bold text-amber-700 tabular-nums">
                  {deliveredViaSms}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  GSM-7 ASCII & toya.link short URL
                </div>
              </div>
            </div>
          </section>

          {loading || !activeRecord ? (
            <div className="border border-slate-200 bg-white rounded-xl p-10 text-center text-sm text-slate-500">
              Loading cascade gateway records...
            </div>
          ) : (
            <>
              {activeTab === 'workbench' && (
                <DispatchWorkbench
                  contacts={contacts}
                  activeRecord={activeRecord}
                  draft={draft}
                  onDraftChange={setDraft}
                  onResetDraft={() => setDraft(INITIAL_DRAFT)}
                  onAddPassenger={() => setAddPassengerOpen(true)}
                  onDispatchCreated={handleDispatchCreated}
                  onOpenDocument={(token) => setPortalToken(token)}
                  onQuickReplyToAssistant={(prompt) => {
                    setDeskPrompt(prompt);
                    setActiveTab('desk');
                  }}
                  passengerInputRef={passengerInputRef}
                />
              )}

              {activeTab === 'ledger' && (
                <DeliveryLedger
                  dispatches={dispatches}
                  recentlyDeliveredIds={recentlyDeliveredIds}
                  onInspectRecord={(record) => {
                    setActiveRecordId(record.id);
                    setActiveTab('workbench');
                  }}
                  onOpenDocument={(token) => setPortalToken(token)}
                  onCreateNew={handleStartNewDispatch}
                />
              )}

              {activeTab === 'passengers' && (
                <SavedPassengersView
                  contacts={contacts}
                  onAddPassenger={() => setAddPassengerOpen(true)}
                  onDispatchToPassenger={handleDispatchToPassenger}
                  onOpenDeskForPassenger={(contact) => {
                    setDeskPrompt(
                      `Assistance needed for ${contact.name} (${contact.recentPnr}, ${contact.recentRoute}).`
                    );
                    setActiveTab('desk');
                  }}
                />
              )}

              {activeTab === 'architecture' && (
                <ArchitectureMatrix
                  onLoadTemplateSample={handleLoadTemplateSample}
                />
              )}

              {activeTab === 'desk' && (
                <ToyaTravelDesk
                  contacts={contacts}
                  initialPrompt={deskPrompt}
                  onConsumeInitialPrompt={() => setDeskPrompt(null)}
                  onLoadExtractedToDispatcher={handleLoadExtractedToDispatcher}
                />
              )}
            </>
          )}
        </main>
      </div>

      <AddPassengerModal
        open={addPassengerOpen}
        onClose={() => setAddPassengerOpen(false)}
        onCreated={handlePassengerCreated}
      />

      <DocumentPortalModal
        token={portalToken}
        onClose={() => {
          setPortalToken(null);
          if (window.location.pathname.startsWith('/t/')) {
            window.history.replaceState({}, '', '/');
          }
        }}
      />

      <AnimatePresence>
        {deliveryToast && (
          <motion.div
            key={deliveryToast.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-xl border border-emerald-200 bg-emerald-50/95 backdrop-blur-xs p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-emerald-950">
                  Delivered via{' '}
                  {deliveryToast.finalChannel === 'whatsapp'
                    ? 'WhatsApp'
                    : deliveryToast.finalChannel === 'rcs'
                      ? 'RCS'
                      : 'SMS'}
                </div>
                <div className="mt-0.5 text-xs text-emerald-900 truncate">
                  {deliveryToast.passengerName} ·{' '}
                  <span className="font-mono">{deliveryToast.pnr}</span> ·{' '}
                  <span className="font-mono">{deliveryToast.id}</span>
                </div>
                <div className="mt-2.5 flex items-center gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ledger');
                      setDeliveryToast(null);
                    }}
                    className="text-emerald-800 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
                  >
                    View in Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPortalToken(deliveryToast.signedToken);
                      setDeliveryToast(null);
                    }}
                    className="text-teal-800 hover:text-teal-950 underline underline-offset-2 cursor-pointer"
                  >
                    Open PDF
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryToast(null)}
                aria-label="Dismiss notification"
                className="p-1 rounded-md text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
