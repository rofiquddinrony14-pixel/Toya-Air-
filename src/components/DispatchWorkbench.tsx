import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Radio,
  Send,
  Smartphone,
  UserCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  DispatchRecord,
  DocumentCategory,
  RecipientConditions,
  SavedContact,
  TemplateLanguage,
} from '../types/cascade';
import { analyzeSmsEncoding } from '../utils/gsm7';
import { CascadeVisualizer } from './CascadeVisualizer';
import { PhonePreview } from './PhonePreview';
import { buildDraftPreviewRecord } from '../utils/previewRecord';

export interface DispatchDraft {
  category: DocumentCategory;
  language: TemplateLanguage;
  smsLanguage: TemplateLanguage;
  passengerName: string;
  pnr: string;
  flightNumber: string;
  route: string;
  departureTime: string;
  previousTime: string;
  visaStatus: string;
  validityRemarks: string;
  airlineOrEmbassy: string;
  to: string;
  fallbackTimeoutSeconds: number;
  acceleratedDemo: boolean;
  conditions: RecipientConditions;
}

interface DispatchWorkbenchProps {
  contacts: SavedContact[];
  activeRecord: DispatchRecord;
  draft: DispatchDraft;
  onDraftChange: (draft: DispatchDraft) => void;
  onResetDraft: () => void;
  onAddPassenger: () => void;
  onDispatchCreated: (record: DispatchRecord) => void;
  onOpenDocument: (token: string) => void;
  onQuickReplyToAssistant: (prompt: string) => void;
  passengerInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function DispatchWorkbench({
  contacts,
  activeRecord,
  draft,
  onDraftChange,
  onResetDraft,
  onAddPassenger,
  onDispatchCreated,
  onOpenDocument,
  onQuickReplyToAssistant,
  passengerInputRef,
}: DispatchWorkbenchProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useLiveDraftPreview, setUseLiveDraftPreview] = useState(false);

  const liveDraftRecord = useMemo(() => buildDraftPreviewRecord(draft), [draft]);

  const updateDraft = (next: DispatchDraft) => {
    setUseLiveDraftPreview(true);
    onDraftChange(next);
  };

  useEffect(() => {
    setUseLiveDraftPreview(false);
  }, [activeRecord.id]);

  // Live SMS fallback preview & GSM-7 encoding analysis
  const previewShortUrl = 'https://toya.link/88492A';
  const previewSmsText = useMemo(() => {
    const isSmsBn = draft.smsLanguage === 'bn';
    if (draft.category === 'flight_schedule_update') {
      return isSmsBn
        ? `তোয়া এয়ার ট্রাভেলস: ফ্লাইট ${draft.flightNumber} (PNR ${draft.pnr}) পুনঃনির্ধারিত হয়েছে। নতুন সময়: ${draft.departureTime} (পূর্বের সময় ${draft.previousTime})। সহায়তার জন্য কল করুন +8801812222277`
        : `ALERT Toya Air Travels: Flight ${draft.flightNumber} (PNR ${draft.pnr}) rescheduled. New departure: ${draft.departureTime} (was ${draft.previousTime}). Need help? Call +8801812222277`;
    }
    if (draft.category === 'visa_application_approved') {
      return isSmsBn
        ? `তোয়া এয়ার ট্রাভেলস: ${draft.passengerName}, আপনার ${draft.route} ভিসা (${draft.pnr}) ${draft.visaStatus} (${draft.validityRemarks})। কপি ডাউনলোড করুন: ${previewShortUrl}`
        : `Toya Air Travels: ${draft.passengerName}, your ${draft.route} visa (${draft.pnr}) is ${draft.visaStatus} (${draft.validityRemarks}). Download copy: ${previewShortUrl}`;
    }
    return isSmsBn
      ? `তোয়া এয়ার ট্রাভেলস: ${draft.passengerName}-এর ফ্লাইট নিশ্চিত হয়েছে। PNR: ${draft.pnr} (${draft.flightNumber}, ${draft.route}, ${draft.departureTime})। টিকিট ডাউনলোড করুন: ${previewShortUrl}`
      : `Toya Air Travels: Flight confirmed for ${draft.passengerName}. PNR: ${draft.pnr} (${draft.flightNumber}, ${draft.route} on ${draft.departureTime}). Download e-ticket: ${previewShortUrl}`;
  }, [draft]);

  const smsAnalysis = useMemo(
    () => analyzeSmsEncoding(previewSmsText),
    [previewSmsText]
  );

  const handleSelectContact = (contact: SavedContact) => {
    const isVisa = contact.recentPnr.startsWith('VISA');
    updateDraft({
      ...draft,
      category: isVisa ? 'visa_application_approved' : 'flight_eticket_issued',
      passengerName: contact.name,
      to: contact.phone,
      route: contact.recentRoute,
      flightNumber: contact.recentFlight,
      pnr: contact.recentPnr,
    });
  };

  const applyTemplateSample = (template: DocumentCategory) => {
    if (template === 'flight_schedule_update') {
      updateDraft({
        ...draft,
        category: 'flight_schedule_update',
        passengerName: 'Sajjad Hossain',
        pnr: '77219K',
        flightNumber: 'EK-585',
        route: 'DAC-DXB',
        previousTime: '09:45PM',
        departureTime: '28 Nov 11:30PM',
        airlineOrEmbassy: 'Emirates · EK-585',
        fallbackTimeoutSeconds: 10,
      });
    } else if (template === 'visa_application_approved') {
      updateDraft({
        ...draft,
        category: 'visa_application_approved',
        passengerName: 'Mahmudul Hasan',
        route: 'UAE Tourist',
        pnr: 'VISA-2026-9041',
        visaStatus: 'Approved',
        validityRemarks: 'Valid till 18 Jan 27',
        flightNumber: 'UAE Visa',
        departureTime: '18 Jan 27',
        airlineOrEmbassy: 'UAE ICP Immigration Authority',
        fallbackTimeoutSeconds: 15,
      });
    } else {
      updateDraft({
        ...draft,
        category: 'flight_eticket_issued',
        passengerName: 'Tariqul Islam',
        pnr: '88492A',
        flightNumber: 'BG-147',
        route: 'DAC-DXB',
        departureTime: '24 Nov 10:30AM',
        airlineOrEmbassy: 'Biman Bangladesh · BG-147',
        fallbackTimeoutSeconds: 20,
      });
    }
  };

  const applyScenarioPreset = (preset: 'whatsapp_ok' | 'rcs_fallback' | 'sms_airport') => {
    if (preset === 'whatsapp_ok') {
      onDraftChange({
        ...draft,
        fallbackTimeoutSeconds: 20,
        conditions: {
          whatsappActive: true,
          dataConnected: true,
          rcsSupported: true,
          smsReachable: true,
          simulateWhatsAppTimeout: false,
        },
      });
    } else if (preset === 'rcs_fallback') {
      onDraftChange({
        ...draft,
        fallbackTimeoutSeconds: 15,
        conditions: {
          whatsappActive: false,
          dataConnected: true,
          rcsSupported: true,
          smsReachable: true,
          simulateWhatsAppTimeout: false,
        },
      });
    } else {
      onDraftChange({
        ...draft,
        fallbackTimeoutSeconds: 10,
        conditions: {
          whatsappActive: true,
          dataConnected: false,
          rcsSupported: false,
          smsReachable: true,
          simulateWhatsAppTimeout: true,
        },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          urgentBoarding: draft.fallbackTimeoutSeconds <= 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Dispatch request failed.');
      }
      setUseLiveDraftPreview(false);
      onDispatchCreated(data.dispatch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to execute dispatch.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setError(null);
  }, [draft.to, draft.pnr, draft.category]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Column: Dispatch Builder & Recipient Simulation */}
      <form
        onSubmit={handleSubmit}
        className="xl:col-span-5 border border-slate-200 bg-white rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Unified API Dispatch Trigger
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Mirrors WhatsApp Utility variables ({'{{1}}'}..{'{{6}}'}) across RCS rich cards and GSM-7 SMS fallbacks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onResetDraft();
              setUseLiveDraftPreview(true);
            }}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset Defaults
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick Contact Fill */}
          {contacts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Saved Toya Air Passengers</span>
                </span>
                <button
                  type="button"
                  onClick={onAddPassenger}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                >
                  + Add New Passenger
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {contacts.map((c) => {
                  const isSelected = draft.to === c.phone && draft.passengerName === c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectContact(c)}
                      className={`px-3 py-2 text-left rounded-lg border text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/60 text-teal-950'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {c.recentRoute} · {c.recentPnr}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Template & Language Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-700">
                WhatsApp Utility Template
              </label>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                {(
                  [
                    { id: 'en', label: 'English (en)' },
                    { id: 'bn', label: 'বাংলা (bn)' },
                  ] as const
                ).map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => updateDraft({ ...draft, language: lang.id })}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      draft.language === lang.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {draft.language === 'bn' && (
              <div className="flex items-center justify-between text-[11px] bg-teal-50/60 border border-teal-200 rounded-lg px-3 py-1.5">
                <span className="text-teal-900">Bengali sample variables ready</span>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft({
                      ...draft,
                      category: 'flight_eticket_issued',
                      language: 'bn',
                      to: '+8801812222277',
                      passengerName: 'তরিকুল ইসলাম',
                      pnr: '88492A',
                      flightNumber: 'বিমান বাংলাদেশ BG-147',
                      route: 'ঢাকা (DAC) থেকে দুবাই (DXB)',
                      departureTime: '২৪ নভেম্বর ২০২৬, সকাল ১০:৩০',
                    })
                  }
                  className="font-semibold text-teal-800 hover:underline cursor-pointer"
                >
                  Fill তরিকুল ইসলাম (88492A)
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'flight_eticket_issued', label: 'E-Ticket Issued' },
                  { id: 'flight_schedule_update', label: 'Schedule Update' },
                  { id: 'visa_application_approved', label: 'Visa Approved' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyTemplateSample(item.id)}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
                    draft.category === item.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mirrored Template Variables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Recipient Phone (E.164)
              </label>
              <input
                type="text"
                required
                value={draft.to}
                onChange={(e) => updateDraft({ ...draft, to: e.target.value })}
                placeholder="+8801700000000"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {'{{1}}'} {draft.category === 'visa_application_approved' ? 'Applicant Name' : 'Passenger Name'}
              </label>
              <input
                ref={passengerInputRef}
                type="text"
                required
                value={draft.passengerName}
                onChange={(e) =>
                  updateDraft({ ...draft, passengerName: e.target.value })
                }
                placeholder="Tariqul Islam"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            {draft.category === 'visa_application_approved' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {'{{2}}'} Country / Visa Type
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.route}
                    onChange={(e) => updateDraft({ ...draft, route: e.target.value })}
                    placeholder="UAE Tourist"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {'{{3}}'} Visa ID / Reference
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.pnr}
                    onChange={(e) => updateDraft({ ...draft, pnr: e.target.value })}
                    placeholder="VISA-2026-9041"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {'{{4}}'} Visa Status
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.visaStatus}
                    onChange={(e) =>
                      updateDraft({ ...draft, visaStatus: e.target.value })
                    }
                    placeholder="Approved"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {'{{5}}'} Validity / Remarks
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.validityRemarks}
                    onChange={(e) =>
                      updateDraft({ ...draft, validityRemarks: e.target.value })
                    }
                    placeholder="Valid till 18 Jan 27"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {'{{2}}'} PNR Code
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.pnr}
                    onChange={(e) => updateDraft({ ...draft, pnr: e.target.value })}
                    placeholder="88492A"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {'{{3}}'} Flight Number
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.flightNumber}
                    onChange={(e) =>
                      updateDraft({ ...draft, flightNumber: e.target.value })
                    }
                    placeholder="BG-147"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {'{{4}}'} Route
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.route}
                    onChange={(e) => updateDraft({ ...draft, route: e.target.value })}
                    placeholder="DAC-DXB"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>

                {draft.category === 'flight_schedule_update' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {'{{5}}'} Previous Time
                    </label>
                    <input
                      type="text"
                      required
                      value={draft.previousTime}
                      onChange={(e) =>
                        updateDraft({ ...draft, previousTime: e.target.value })
                      }
                      placeholder="09:45PM"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {draft.category === 'flight_schedule_update'
                      ? '{{6}} New Departure'
                      : '{{5}} Departure'}
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.departureTime}
                    onChange={(e) =>
                      updateDraft({ ...draft, departureTime: e.target.value })
                    }
                    placeholder="24 Nov 10:30AM"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
              </>
            )}
          </div>

          {/* Timeout Policy */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Fallback Timeout Window</span>
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                {draft.fallbackTimeoutSeconds}s
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 10, label: '10s · Urgent Check-in' },
                { val: 20, label: '20s · Standard' },
                { val: 30, label: '30s · Relaxed' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() =>
                    onDraftChange({ ...draft, fallbackTimeoutSeconds: opt.val })
                  }
                  className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap truncate cursor-pointer ${
                    draft.fallbackTimeoutSeconds === opt.val
                      ? 'border-teal-600 bg-teal-50/70 text-teal-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between text-xs text-slate-600 pt-1 cursor-pointer">
              <span>Accelerated live preview timing (~2s instead of real wait)</span>
              <input
                type="checkbox"
                checked={draft.acceleratedDemo}
                onChange={(e) =>
                  onDraftChange({ ...draft, acceleratedDemo: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
            </label>
          </div>

          {/* Recipient Network Conditions Simulator */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Recipient Device & Network Conditions
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => applyScenarioPreset('whatsapp_ok')}
                  className="text-teal-700 hover:underline cursor-pointer"
                >
                  WhatsApp OK
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => applyScenarioPreset('rcs_fallback')}
                  className="text-teal-700 hover:underline cursor-pointer"
                >
                  No WhatsApp
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => applyScenarioPreset('sms_airport')}
                  className="text-teal-700 hover:underline cursor-pointer"
                >
                  Airport Offline
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              <label className="flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-slate-50">
                <span className="flex items-center gap-2 text-slate-700">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Number Active on WhatsApp</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.conditions.whatsappActive}
                  onChange={(e) =>
                    onDraftChange({
                      ...draft,
                      conditions: {
                        ...draft.conditions,
                        whatsappActive: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
              </label>

              <label className="flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-slate-50">
                <span className="flex items-center gap-2 text-slate-700">
                  {draft.conditions.dataConnected ? (
                    <Wifi className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>Mobile Data / Wi-Fi Online</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.conditions.dataConnected}
                  onChange={(e) =>
                    onDraftChange({
                      ...draft,
                      conditions: {
                        ...draft.conditions,
                        dataConnected: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
              </label>

              <label className="flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-slate-50">
                <span className="flex items-center gap-2 text-slate-700">
                  <Radio className="w-3.5 h-3.5 text-slate-500" />
                  <span>Carrier & Handset Supports RCS</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.conditions.rcsSupported}
                  onChange={(e) =>
                    onDraftChange({
                      ...draft,
                      conditions: {
                        ...draft.conditions,
                        rcsSupported: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
              </label>

              <label className="flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-slate-50">
                <span className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Simulate WhatsApp Timeout ({draft.fallbackTimeoutSeconds}s)</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.conditions.simulateWhatsAppTimeout}
                  onChange={(e) =>
                    onDraftChange({
                      ...draft,
                      conditions: {
                        ...draft.conditions,
                        simulateWhatsAppTimeout: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
              </label>
            </div>
          </div>

          {/* GSM-7 SMS Segment & Encoding Guard */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700">SMS Fallback Encoding</span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md">
                <button
                  type="button"
                  onClick={() => updateDraft({ ...draft, smsLanguage: 'en' })}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    draft.smsLanguage === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  GSM-7 ASCII
                </button>
                <button
                  type="button"
                  onClick={() => updateDraft({ ...draft, smsLanguage: 'bn' })}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    draft.smsLanguage === 'bn'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  বাংলা Unicode
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between tabular-nums">
              <span className="text-slate-500">Segment Budget</span>
              <span
                className={`font-mono font-semibold ${
                  smsAnalysis.encoding === 'GSM-7' && smsAnalysis.segments === 1
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {smsAnalysis.encoding} · {smsAnalysis.charCount}/{smsAnalysis.singleLimit} ·{' '}
                {smsAnalysis.segments} seg
              </span>
            </div>
            {smsAnalysis.encoding === 'UCS-2' && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Unicode (UCS-2) characters present ({smsAnalysis.segments} SMS segments at 67–70 chars/segment). Switch to GSM-7 ASCII for 1-segment cost efficiency.
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {submitting ? 'Dispatching Unified Request...' : 'Execute Fallback Cascade'}
            </span>
          </button>
        </div>
      </form>

      {/* Right Column: Live Cascade Execution + Handset Preview */}
      <div className="xl:col-span-7 space-y-6">
        <CascadeVisualizer record={activeRecord} />
        <PhonePreview
          record={useLiveDraftPreview ? liveDraftRecord : activeRecord}
          isLiveDraft={useLiveDraftPreview}
          onToggleLiveDraft={setUseLiveDraftPreview}
          onOpenDocument={onOpenDocument}
          onQuickReply={(replyText) => {
            const target = useLiveDraftPreview ? liveDraftRecord : activeRecord;
            if (replyText === 'Request ticket quote') {
              onQuickReplyToAssistant(
                `Customer ${target.passengerName} clicked "Request ticket quote" after ${target.route} visa (${target.pnr}) approval.`
              );
            } else if (replyText === 'Support Desk' || replyText === 'Visa Desk' || replyText === 'Call Travel Desk') {
              onQuickReplyToAssistant(
                `Customer ${target.passengerName} requested "${replyText}" for ${target.pnr} (${target.route}).`
              );
            }
          }}
        />
      </div>
    </div>
  );
}
