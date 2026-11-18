import { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, FileCheck2, Link2, Lock, Zap } from 'lucide-react';
import type { DocumentCategory, TemplateLanguage } from '../types/cascade';

interface ArchitectureMatrixProps {
  onLoadTemplateSample: (template: DocumentCategory, language?: TemplateLanguage) => void;
}

const CASCADE_MATRIX = [
  {
    priority: '1 (Primary)',
    channel: 'WhatsApp',
    trigger: 'Default first attempt for opted-in passengers.',
    payload: 'Approved Utility template + attached PDF (e-ticket/visa) + interactive buttons.',
    timeout: '15–30 seconds (or immediate if number lacks WhatsApp).',
  },
  {
    priority: '2 (Secondary)',
    channel: 'RCS',
    trigger: 'Passenger is not on WhatsApp or message remains undelivered past timeout.',
    payload: 'Verified branded rich card + tokenized download link + quick-reply & dial actions.',
    timeout: '10–15 seconds (or immediate if carrier/handset lacks RCS).',
  },
  {
    priority: '3 (Safety Net)',
    channel: 'SMS',
    trigger: 'Recipient lacks both WhatsApp and RCS, or has no mobile data/Wi-Fi.',
    payload: 'Strict GSM-7 plain text (under 160 chars) + short branded URL (https://toya.link/xxxx).',
    timeout: 'Final guaranteed delivery.',
  },
];

interface TemplateSpec {
  id: DocumentCategory;
  title: string;
  en: {
    templateName: string;
    headerType: string;
    body: string;
    footer: string;
    buttons: string[];
    rcsCardTitle: string;
    rcsDescription: string;
    rcsActions: string[];
  };
  bn: {
    templateName: string;
    headerType: string;
    body: string;
    footer: string;
    buttons: string[];
    rcsCardTitle: string;
    rcsDescription: string;
    rcsActions: string[];
  };
  variables: string[];
  smsTemplate: string;
  sampleSms: string;
  sampleChars: number;
}

const MIRRORED_TEMPLATES: TemplateSpec[] = [
  {
    id: 'flight_eticket_issued',
    title: '1. Flight E-Ticket Issuance',
    variables: [
      '{{1}} Passenger Name',
      '{{2}} PNR',
      '{{3}} Flight Number',
      '{{4}} Route',
      '{{5}} Departure',
    ],
    en: {
      templateName: 'flight_eticket_issued',
      headerType: 'Document (PDF)',
      body: 'Hello {{1}}, your flight ticket is confirmed and attached above.\n• PNR / Booking Code: {{2}}\n• Airline & Flight: {{3}}\n• Route: {{4}}\n• Departure: {{5}}\nPlease verify passenger name and passport details immediately.',
      footer: 'Toya Air Travels • Customer Support',
      buttons: ['Details are correct', 'Report a correction'],
      rcsCardTitle: 'Flight E-Ticket Confirmed • PNR: {{2}}',
      rcsDescription:
        'Passenger: {{1}} Flight: {{3}} ({{4}}) Departure: {{5}}\nYour e-ticket is ready. Please verify your name and passport details immediately.',
      rcsActions: [
        'Open URL: Download E-Ticket (PDF) → {{download_url}}',
        'Postback: Details are correct',
        'Dial Phone: Support Desk → +8801812222277',
      ],
    },
    bn: {
      templateName: 'flight_eticket_issued_bn',
      headerType: 'Document (PDF)',
      body: 'আসসালামু আলাইকুম/নমস্কার {{1}}, আপনার বিমানের টিকিট নিশ্চিত করা হয়েছে এবং ই-টিকিটটি উপরে সংযুক্ত করা হলো।\n• পিএনআর / বুকিং কোড: {{2}}\n• এয়ারলাইন ও ফ্লাইট: {{3}}\n• রুট: {{4}}\n• প্রস্থানের সময়: {{5}}\nঅনুগ্রহ করে সংযুক্ত টিকিটে যাত্রীর নাম ও পাসপোর্টের বিবরণ ভালোভাবে যাচাই করে নিন এবং কোনো ভুল থাকলে দ্রুত আমাদের জানান।',
      footer: 'তোয়া এয়ার ট্রাভেলস • কাস্টমার সাপোর্ট',
      buttons: ['তথ্য সঠিক আছে', 'ত্রুটি সংশোধন করুন'],
      rcsCardTitle: 'ফ্লাইট ই-টিকিট নিশ্চিত • পিএনআর: {{2}}',
      rcsDescription:
        'যাত্রী: {{1}} | ফ্লাইট: {{3}} ({{4}}) | প্রস্থান: {{5}}\nআপনার ই-টিকিট প্রস্তুত। অনুগ্রহ করে নাম ও পাসপোর্টের তথ্য যাচাই করে নিন।',
      rcsActions: [
        'Open URL: ই-টিকিট ডাউনলোড (PDF) → {{download_url}}',
        'Postback: তথ্য সঠিক আছে',
        'Dial Phone: সাপোর্ট ডেস্ক → +8801812222277',
      ],
    },
    smsTemplate:
      'Toya Air Travels: Flight confirmed for {{1}}. PNR: {{2}} ({{3}}, {{4}} on {{5}}). Download e-ticket: {{download_url}}',
    sampleSms:
      'Toya Air Travels: Flight confirmed for Tariqul Islam. PNR: 88492A (BG-147, DAC-DXB on 24 Nov 10:30AM). Download e-ticket: https://toya.link/88492A',
    sampleChars: 144,
  },
  {
    id: 'flight_schedule_update',
    title: '2. Flight Schedule Change / Delay Alert',
    variables: [
      '{{1}} Passenger Name',
      '{{2}} PNR',
      '{{3}} Flight Number',
      '{{4}} Route',
      '{{5}} Previous Time',
      '{{6}} New Departure',
    ],
    en: {
      templateName: 'flight_schedule_update',
      headerType: 'Text — Urgent Flight Schedule Update',
      body: 'Dear {{1}}, the airline has updated the schedule for your upcoming flight (PNR: {{2}}).\n• Flight: {{3}} ({{4}})\n• Previous Time: {{5}}\n• New Departure: {{6}}\nPlease plan your airport arrival based on the updated schedule.',
      footer: 'Toya Air Travels • Automated Flight Alert',
      buttons: ['Acknowledge new time', 'Call Travel Desk (+8801812222277)'],
      rcsCardTitle: 'Schedule Update: {{3}} (PNR: {{2}})',
      rcsDescription:
        'Dear {{1}}, your flight ({{4}}) has been rescheduled by the airline.\n• Previous Time: {{5}} • New Departure: {{6}}',
      rcsActions: [
        'Postback: Acknowledge new time',
        'Dial Phone: Call Travel Desk → +8801812222277',
      ],
    },
    bn: {
      templateName: 'flight_schedule_update_bn',
      headerType: 'Text — জরুরি ফ্লাইট সময়সূচী আপডেট',
      body: 'প্রিয় {{1}}, এয়ারলাইন কতৃপক্ষ আপনার আসন্ন ফ্লাইটের সময়সূচীতে পরিবর্তন এনেছে (পিএনআর: {{2}})।\n• ফ্লাইট: {{3}} ({{4}})\n• পূর্বের সময়: {{5}}\n• নতুন প্রস্থানের সময়: {{6}}\nপরিবর্তিত সময় অনুযায়ী বিমানবন্দর গমনের প্রস্তুতি নিন। রি-বুকিং বা সংযোগকারী ফ্লাইটের সহায়তার জন্য নিচের বাটনে যোগাযোগ করুন।',
      footer: 'তোয়া এয়ার ট্রাভেলস • অটোমেটেড ফ্লাইট অ্যালার্ট',
      buttons: ['নতুন সময় বুঝে পেয়েছি', 'ট্রাভেল ডেস্কে কল করুন (+8801812222277)'],
      rcsCardTitle: 'সময়সূচী আপডেট: {{3}} (পিএনআর: {{2}})',
      rcsDescription:
        'প্রিয় {{1}}, আপনার ফ্লাইটটি ({{4}}) এয়ারলাইন কতৃপক্ষ পুনঃনির্ধারণ করেছে।\n• পূর্বের সময়: {{5}} • নতুন প্রস্থান: {{6}}',
      rcsActions: [
        'Postback: নতুন সময় বুঝে পেয়েছি',
        'Dial Phone: ট্রাভেল ডেস্ক → +8801812222277',
      ],
    },
    smsTemplate:
      'ALERT Toya Air Travels: Flight {{3}} (PNR {{2}}) rescheduled. New departure: {{6}} (was {{5}}). Need help? Call +8801812222277',
    sampleSms:
      'ALERT Toya Air Travels: Flight EK-585 (PNR 77219K) rescheduled. New departure: 28 Nov 11:30PM (was 09:45PM). Need help? Call +8801812222277',
    sampleChars: 139,
  },
  {
    id: 'visa_application_approved',
    title: '3. Visa Application Status & Approval',
    variables: [
      '{{1}} Applicant Name',
      '{{2}} Country / Visa Type',
      '{{3}} Visa ID / Ref',
      '{{4}} Status',
      '{{5}} Validity / Remarks',
    ],
    en: {
      templateName: 'visa_application_approved',
      headerType: 'Document (PDF)',
      body: 'Hello {{1}}, there is an update regarding your {{2}} visa application (ID: {{3}}).\n• Current Status: {{4}}\n• Validity / Remarks: {{5}}\nYour visa copy is attached above. Please verify your passport details before booking flights.',
      footer: 'Toya Air Travels • Visa Processing Desk',
      buttons: ['Received, thank you', 'Request ticket quote'],
      rcsCardTitle: '{{2}} Visa {{4}} • Ref: {{3}}',
      rcsDescription:
        'Hello {{1}}, your {{2}} visa (ID: {{3}}) is now {{4}}.\nValidity / Remarks: {{5}}',
      rcsActions: [
        'Open URL: Download Visa Copy (PDF) → {{download_url}}',
        'Postback: Request ticket quote',
        'Dial Phone: Visa Desk → +8801812222277',
      ],
    },
    bn: {
      templateName: 'visa_application_approved_bn',
      headerType: 'Document (PDF)',
      body: 'আসসালামু আলাইকুম/নমস্কার {{1}}, আপনার {{2}} ভিসা আবেদন সম্পর্কে একটি আপডেট রয়েছে (আবেদন আইডি: {{3}})।\n• বর্তমান অবস্থা: {{4}}\n• ভিসার মেয়াদ / মন্তব্য: {{5}}\nআপনার ভিসার কপি এই বার্তার সাথে সংযুক্ত করা হয়েছে। ভ্রমণের তারিখ চূড়ান্ত করার আগে পাসপোর্টের তথ্য মিলিয়ে নিন।',
      footer: 'তোয়া এয়ার ট্রাভেলস • ভিসা প্রসেসিং ডেস্ক',
      buttons: ['পেয়েছি, ধন্যবাদ', 'টিকিটের কোটেশন দিন'],
      rcsCardTitle: '{{2}} ভিসা {{4}} • আইডি: {{3}}',
      rcsDescription:
        'হ্যালো {{1}}, আপনার {{2}} ভিসা (আইডি: {{3}}) এখন {{4}}।\nমেয়াদ / মন্তব্য: {{5}}',
      rcsActions: [
        'Open URL: ভিসা কপি ডাউনলোড (PDF) → {{download_url}}',
        'Postback: টিকিটের কোটেশন দিন',
        'Dial Phone: ভিসা ডেস্ক → +8801812222277',
      ],
    },
    smsTemplate:
      'Toya Air Travels: {{1}}, your {{2}} visa ({{3}}) is {{4}} ({{5}}). Download copy: {{download_url}}',
    sampleSms:
      'Toya Air Travels: Mahmudul Hasan, your UAE Tourist visa (VISA-2026-9041) is Approved (Valid till 18 Jan 27). Download copy: https://toya.link/9041',
    sampleChars: 148,
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01. Booking or Visa Event Trigger',
    detail:
      'Booking system or CRM generates the final flight e-ticket PDF or visa approval document and uploads it to secure storage to create a short tokenized download link.',
  },
  {
    step: '02. Single Unified API Call',
    detail:
      'Backend dispatches one API request containing the passenger phone number, mirrored variables ({{1}}..{{6}}), template language (en or bn), PDF attachment URL, and GSM-7 SMS fallback text.',
  },
  {
    step: '03. Channel 1 — WhatsApp Attempt',
    detail:
      'Unified gateway checks whether the number is active on WhatsApp. If delivered, the Meta Utility template arrives inside chat with interactive buttons and the cascade stops.',
  },
  {
    step: '04. Channel 2 — RCS Attempt',
    detail:
      'Gateway queries carrier capabilities for RCS Business Messaging. If supported, a verified rich card in English or Bengali arrives with Download PDF, Postback, and Dial (+8801812222277) actions.',
  },
  {
    step: '05. Channel 3 — SMS Final Fallback',
    detail:
      'Dispatches a strict GSM-7 alert under 160 characters containing the PNR/reference, status, and short branded link (https://toya.link/xxxx) for offline reachability.',
  },
];

const IMPLEMENTATION_RULES = [
  {
    icon: FileCheck2,
    title: 'Keep SMS Strictly GSM-7 (ASCII)',
    body: 'Avoid emojis or Bengali Unicode characters in SMS fallbacks—even when WhatsApp and RCS are sent in Bengali—otherwise the single-segment limit drops from 160 to 70 chars.',
  },
  {
    icon: Link2,
    title: 'Use Short Branded Links (Under 22 Chars)',
    body: 'Keep {{download_url}} short (e.g., https://toya.link/xxxx) so passenger names and flight codes never push the fallback SMS past the 160-character single-segment boundary.',
  },
  {
    icon: Lock,
    title: 'Host PDFs Behind Tokenized URLs',
    body: 'Because RCS rich cards cannot attach raw PDF files in standard carrier profiles, route RCS Open URL buttons and SMS links to expiring tokenized download URLs.',
  },
  {
    icon: Clock,
    title: 'Keep Timeouts Short for Urgent Boarding',
    body: 'For schedule changes and airport check-ins, set fallbackTimeoutSeconds to 10 seconds so offline WhatsApp messages convert immediately to SMS.',
  },
];

export function ArchitectureMatrix({ onLoadTemplateSample }: ArchitectureMatrixProps) {
  const [specLang, setSpecLang] = useState<TemplateLanguage>('bn');

  return (
    <div className="space-y-8">
      {/* Architecture Table */}
      <section className="border border-slate-200 bg-white rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Fallback Cascade Architecture
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Deterministic three-tier routing across WhatsApp, RCS Business Messaging, and SMS.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLoadTemplateSample('flight_eticket_issued', specLang)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Load PNR-88492A Sample ({specLang.toUpperCase()})</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50/40">
                <th className="py-3 px-4 whitespace-nowrap">Priority</th>
                <th className="py-3 px-4 whitespace-nowrap">Channel</th>
                <th className="py-3 px-4">Trigger Condition</th>
                <th className="py-3 px-4">Payload Format</th>
                <th className="py-3 px-4 whitespace-nowrap">Timeout Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {CASCADE_MATRIX.map((row) => (
                <tr key={row.channel} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                    {row.priority}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {row.channel}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-[13px] leading-relaxed">
                    {row.trigger}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-[13px] leading-relaxed">
                    {row.payload}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-700 leading-relaxed tabular-nums">
                    {row.timeout}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mirrored Template Specifications */}
      <section className="border border-slate-200 bg-white rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Mirrored WhatsApp → RCS → SMS Templates
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Meta-compliant Utility templates in English and Bengali, mirrored with RCS rich cards and GSM-7 SMS fallbacks.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setSpecLang('bn')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                specLang === 'bn'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              বাংলা (bn)
            </button>
            <button
              type="button"
              onClick={() => setSpecLang('en')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                specLang === 'en'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English (en)
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {MIRRORED_TEMPLATES.map((tpl) => {
            const loc = tpl[specLang];
            return (
              <div key={tpl.id} className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{tpl.title}</h4>
                    <div className="text-xs font-mono text-slate-500 mt-0.5">
                      {loc.templateName} · Category: Utility · Header: {loc.headerType}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLoadTemplateSample(tpl.id, specLang)}
                    className="px-3 py-1.5 text-xs font-semibold text-teal-800 border border-teal-200 bg-teal-50/50 hover:bg-teal-100/60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Load {specLang.toUpperCase()} into Workbench
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                  {/* WhatsApp Utility */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                    <div className="font-semibold text-slate-800">
                      WhatsApp Utility ({specLang.toUpperCase()})
                    </div>
                    <p className="text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-line">
                      {loc.body}
                    </p>
                    <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-1.5">
                      Footer: {loc.footer}
                    </div>
                    <div className="text-[11px] text-teal-800 font-medium">
                      Buttons: {loc.buttons.join(' · ')}
                    </div>
                  </div>

                  {/* RCS Rich Card */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                    <div className="font-semibold text-slate-800">
                      RCS Rich Card ({specLang.toUpperCase()})
                    </div>
                    <div className="font-semibold text-slate-900">{loc.rcsCardTitle}</div>
                    <p className="text-[11.5px] text-slate-700 leading-relaxed whitespace-pre-line">
                      {loc.rcsDescription}
                    </p>
                    <ul className="space-y-1 text-slate-600 pt-1 border-t border-slate-200">
                      {loc.rcsActions.map((act) => (
                        <li key={act} className="font-mono text-[11px]">
                          • {act}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* SMS Fallback */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        SMS Fallback (GSM-7 ASCII)
                      </span>
                      <span className="font-mono text-emerald-700 tabular-nums">
                        {tpl.sampleChars} chars
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-700 leading-relaxed">
                      {tpl.smsTemplate}
                    </p>
                    <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-2">
                      Sample: {tpl.sampleSms}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Step-by-Step Workflow & Key Implementation Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 border border-slate-200 bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h3 className="text-base font-semibold text-slate-900">
              Step-by-Step Workflow Logic
            </h3>
          </div>
          <div className="divide-y divide-slate-200">
            {WORKFLOW_STEPS.map((item) => (
              <div key={item.step} className="p-4 sm:px-5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">{item.step}</h4>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 border border-slate-200 bg-white rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h3 className="text-base font-semibold text-slate-900">
              SMS & RCS Formatting Rules
            </h3>
          </div>
          <div className="divide-y divide-slate-200">
            {IMPLEMENTATION_RULES.map((rule) => {
              const Icon = rule.icon;
              return (
                <div key={rule.title} className="p-4 sm:px-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icon className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>{rule.title}</span>
                  </div>
                  <p className="text-[13px] text-slate-600 leading-relaxed pl-6">
                    {rule.body}
                  </p>
                </div>
              );
            })}

            <div className="p-4 sm:px-5 bg-slate-50/60 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                All tokenized links generated by this console resolve to verifiable PDF downloads at{' '}
                <span className="font-mono text-slate-800">/api/documents/:token/download</span>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
