import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  CascadeStepLog,
  ChannelId,
  DispatchRecord,
  DocumentCategory,
  RecipientConditions,
  SavedContact,
  UnifiedDispatchPayload,
} from './src/types/cascade.ts';
import { analyzeSmsEncoding } from './src/utils/gsm7.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const SUPPORT_DIAL_NUMBER = '+8801812222277';

const TOYA_SYSTEM_INSTRUCTION = `You are the official AI assistant for Toya Air Travels (তোয়া এয়ার ট্রাভেলস), located at New Market Road, Sobji Mohol, Katiadi Bazar, Kishoreganj, Bangladesh.
Proprietor: Rofiq Uddin Rony.
Hotlines: +8801713-476408, +8801711-396378, Travel Desk: +8801812222277.
WhatsApp: https://wa.me/8801812222277 (toyaairbd) and https://wa.me/+8801713476408
Email: toyaairtravelsbd@gmail.com
Website: www.toyaairbd.com

Follow these strict rules:
1. Greeting & Saved Contacts:
   - Warmly greet incoming customers in natural Bengali (or English if they write in English).
   - If a saved contact name is provided in context, address them by name (e.g., "হ্যালো [নাম], কেমন আছেন? তোয়া এয়ার ট্রাভেলসে আপনাকে স্বাগতম।").
2. Office Details & Location:
   - When asked for the office address, provide: নিউ মার্কেট রোড, সবজি মহল, কটিয়াদী বাজার, কিশোরগঞ্জ।
   - Route Directions: FIRST ask the customer: "আপনি কোন জায়গা থেকে আসবেন?" before giving directions. Once they state their starting point, provide local Kishoreganj/Katiadi landmarks such as কটিয়াদী বাস স্ট্যান্ড, বুকপাড়া মোড়, থানাপট্টি রোড ইত্যাদি.
3. Air Ticket Fares & Inquiries:
   - NEVER quote fixed or direct air ticket prices in chat, because international airfares and USD rates fluctuate constantly.
   - For any ticket booking, date change, reissue, or pricing inquiry, immediately direct the customer to our official WhatsApp (+8801713476408 / https://wa.me/+8801713476408) so the team can share real-time rates.
4. Document / Ticket Review:
   - If a ticket, passport, or visa document is shared, verify the passenger name and reference/PNR carefully and ask how we can assist with that specific service (date change, reissue, visa processing, or hotel booking).
5. Unclear Queries & Emergencies:
   - Never guess or invent answers when uncertain. Politely ask them to wait for a human representative.
   - For urgent travel or emergency assistance, inform them the team may be busy at the office and can be reached directly by phone at +8801713-476408 or +8801711-396378.
6. Tone: Concise, warm, professional, accurate. Keep responses clear and scannable.`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SAVED_CONTACTS: SavedContact[] = [
  {
    id: 'c-1',
    name: 'Tariqul Islam',
    bengaliName: 'তারিকুল ইসলাম',
    phone: '+8801700000000',
    recentRoute: 'DAC-DXB',
    recentFlight: 'BG-147',
    recentPnr: '88492A',
    whatsappOptIn: true,
  },
  {
    id: 'c-2',
    name: 'Sajjad Hossain',
    bengaliName: 'সাজ্জাদ হোসেন',
    phone: '+8801713476408',
    recentRoute: 'DAC-DXB',
    recentFlight: 'EK-585',
    recentPnr: '77219K',
    whatsappOptIn: true,
  },
  {
    id: 'c-3',
    name: 'Mahmudul Hasan',
    bengaliName: 'মাহমুদুল হাসান',
    phone: '+8801911778899',
    recentRoute: 'UAE Tourist',
    recentFlight: 'UAE Visa',
    recentPnr: 'VISA-2026-9041',
    whatsappOptIn: true,
  },
  {
    id: 'c-4',
    name: 'Nusrat Jahan',
    bengaliName: 'নুসরাত জাহান',
    phone: '+8801812445566',
    recentRoute: 'DAC-RUH',
    recentFlight: 'SV-805',
    recentPnr: 'KSA-40918',
    whatsappOptIn: true,
  },
];

const dispatches = new Map<string, DispatchRecord>();
const tokenIndex = new Map<string, string>();
const activeTimers = new Map<string, NodeJS.Timeout[]>();

function makeShortToken(): string {
  // 4-char hex/alnum token keeps https://toya.link/xxxx exactly 22 chars
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

function normalizePhone(raw: unknown, fallback = '+8801812222277'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[\s"']+/g, '').trim();
  return cleaned || fallback;
}

function buildPayload(params: {
  to: string;
  category: DocumentCategory;
  language: 'en' | 'bn';
  smsLanguage?: 'en' | 'bn';
  passengerName: string;
  pnr: string;
  flightNumber: string;
  route: string;
  departureTime: string;
  previousTime?: string;
  visaStatus?: string;
  validityRemarks?: string;
  fallbackTimeoutSeconds: number;
  signedToken: string;
  baseUrl: string;
  pdfFilename: string;
}): UnifiedDispatchPayload {
  const {
    to,
    category,
    language,
    smsLanguage = 'en',
    passengerName,
    pnr,
    flightNumber,
    route,
    departureTime,
    previousTime = '09:45PM',
    visaStatus = 'Approved',
    validityRemarks = 'Valid till 18 Jan 27',
    fallbackTimeoutSeconds,
    signedToken,
    pdfFilename,
  } = params;

  const shortUrl = `https://toya.link/${signedToken}`;
  const cdnMediaUrl =
    category === 'visa_application_approved'
      ? `https://cdn.toyaairbd.com/visas/${pnr}.pdf`
      : `https://cdn.toyaairbd.com/tickets/PNR-${pnr}.pdf`;
  const isBn = language === 'bn';
  const isSmsBn = smsLanguage === 'bn';
  const docTypeMeta =
    category === 'visa_application_approved'
      ? 'visa_approval'
      : category === 'flight_schedule_update'
        ? 'schedule_update'
        : 'eticket';
  const metadata = {
    agency: 'Toya Air Travels',
    branch: 'Katiadi Bazar, Kishoreganj',
    bookingRef: pnr,
    documentType: docTypeMeta,
  } as const;

  if (category === 'flight_schedule_update') {
    const variables = [
      passengerName,
      pnr,
      flightNumber,
      route,
      previousTime,
      departureTime,
    ];
    const variableLabels = [
      '{{1}} Passenger Name',
      '{{2}} PNR',
      '{{3}} Flight Number',
      '{{4}} Route',
      '{{5}} Previous Time',
      '{{6}} New Departure',
    ];
    const smsText = isSmsBn
      ? `তোয়া এয়ার ট্রাভেলস: ফ্লাইট ${flightNumber} (PNR ${pnr}) পুনঃনির্ধারিত হয়েছে। নতুন সময়: ${departureTime} (পূর্বের সময় ${previousTime})। সহায়তার জন্য কল করুন ${SUPPORT_DIAL_NUMBER}`
      : `ALERT Toya Air Travels: Flight ${flightNumber} (PNR ${pnr}) rescheduled. New departure: ${departureTime} (was ${previousTime}). Need help? Call ${SUPPORT_DIAL_NUMBER}`;
    const smsReport = analyzeSmsEncoding(smsText);

    return {
      to,
      channelPriority: ['whatsapp', 'rcs', 'sms'],
      fallbackTimeoutSeconds,
      content: {
        whatsapp: {
          templateName: isBn ? 'flight_schedule_update_bn' : 'flight_schedule_update',
          templateCategory: 'UTILITY',
          language,
          headerType: 'TEXT',
          headerText: isBn ? 'জরুরি ফ্লাইট সময়সূচী আপডেট' : 'Urgent Flight Schedule Update',
          bodyText: isBn
            ? `প্রিয় ${passengerName}, এয়ারলাইন কতৃপক্ষ আপনার আসন্ন ফ্লাইটের সময়সূচীতে পরিবর্তন এনেছে (পিএনআর: ${pnr})।\n• ফ্লাইট: ${flightNumber} (${route})\n• পূর্বের সময়: ${previousTime}\n• নতুন প্রস্থানের সময়: ${departureTime}\nপরিবর্তিত সময় অনুযায়ী বিমানবন্দর গমনের প্রস্তুতি নিন। রি-বুকিং বা সংযোগকারী ফ্লাইটের সহায়তার জন্য নিচের বাটনে যোগাযোগ করুন।`
            : `Dear ${passengerName}, the airline has updated the schedule for your upcoming flight (PNR: ${pnr}).\n• Flight: ${flightNumber} (${route})\n• Previous Time: ${previousTime}\n• New Departure: ${departureTime}\nPlease plan your airport arrival based on the updated schedule.`,
          footerText: isBn
            ? 'তোয়া এয়ার ট্রাভেলস • অটোমেটেড ফ্লাইট অ্যালার্ট'
            : 'Toya Air Travels • Automated Flight Alert',
          variables,
          variableLabels,
          quickReplies: isBn
            ? ['নতুন সময় বুঝে পেয়েছি', `ট্রাভেল ডেস্কে কল করুন (${SUPPORT_DIAL_NUMBER})`]
            : ['Acknowledge new time', `Call Travel Desk (${SUPPORT_DIAL_NUMBER})`],
        },
        rcs: {
          cardTitle: isBn
            ? `সময়সূচী আপডেট: ${flightNumber} (পিএনআর: ${pnr})`
            : `Schedule Update: ${flightNumber} (PNR: ${pnr})`,
          cardDescription: isBn
            ? `প্রিয় ${passengerName}, আপনার ফ্লাইটটি (${route}) এয়ারলাইন কতৃপক্ষ পুনঃনির্ধারণ করেছে।\n• পূর্বের সময়: ${previousTime}\n• নতুন প্রস্থান: ${departureTime}\nনতুন সময় অনুযায়ী যাত্রার প্রস্তুতি নিন।`
            : `Dear ${passengerName}, your flight (${route}) has been rescheduled by the airline.\n\n• Previous Time: ${previousTime} • New Departure: ${departureTime}\n\nPlan your airport arrival based on the updated schedule.`,
          mediaUrl: cdnMediaUrl,
          bannerImageUrl: '/src/assets/images/rcs_flight_banner_1795035420538.jpg',
          verifiedSender: 'Toya Air Travels',
          suggestedActions: [
            {
              type: 'reply',
              text: isBn ? 'নতুন সময় বুঝে পেয়েছি' : 'Acknowledge new time',
            },
            {
              type: 'dial',
              text: isBn ? 'ট্রাভেল ডেস্ক' : 'Call Travel Desk',
              phoneNumber: SUPPORT_DIAL_NUMBER,
            },
          ],
        },
        sms: {
          text: smsText,
          shortUrl,
          encoding: smsReport.encoding,
          charCount: smsReport.charCount,
          segments: smsReport.segments,
          singleLimit: smsReport.singleLimit,
        },
      },
      metadata,
    };
  }

  if (category === 'visa_application_approved') {
    const variables = [passengerName, route, pnr, visaStatus, validityRemarks];
    const variableLabels = [
      '{{1}} Applicant Name',
      '{{2}} Country / Visa Type',
      '{{3}} Visa ID / Ref',
      '{{4}} Status',
      '{{5}} Validity / Remarks',
    ];
    const smsText = isSmsBn
      ? `তোয়া এয়ার ট্রাভেলস: ${passengerName}, আপনার ${route} ভিসা (${pnr}) ${visaStatus} (${validityRemarks})। কপি ডাউনলোড করুন: ${shortUrl}`
      : `Toya Air Travels: ${passengerName}, your ${route} visa (${pnr}) is ${visaStatus} (${validityRemarks}). Download copy: ${shortUrl}`;
    const smsReport = analyzeSmsEncoding(smsText);

    return {
      to,
      channelPriority: ['whatsapp', 'rcs', 'sms'],
      fallbackTimeoutSeconds,
      content: {
        whatsapp: {
          templateName: isBn ? 'visa_application_approved_bn' : 'visa_application_approved',
          templateCategory: 'UTILITY',
          language,
          headerType: 'DOCUMENT',
          headerMediaUrl: cdnMediaUrl,
          headerFilename: pdfFilename,
          bodyText: isBn
            ? `আসসালামু আলাইকুম/নমস্কার ${passengerName}, আপনার ${route} ভিসা আবেদন সম্পর্কে একটি আপডেট রয়েছে (আবেদন আইডি: ${pnr})।\n• বর্তমান অবস্থা: ${visaStatus}\n• ভিসার মেয়াদ / মন্তব্য: ${validityRemarks}\nআপনার ভিসার কপি এই বার্তার সাথে সংযুক্ত করা হয়েছে। ভ্রমণের তারিখ চূড়ান্ত করার আগে পাসপোর্টের তথ্য মিলিয়ে নিন।`
            : `Hello ${passengerName}, there is an update regarding your ${route} visa application (ID: ${pnr}).\n• Current Status: ${visaStatus}\n• Validity / Remarks: ${validityRemarks}\nYour visa copy is attached above. Please verify your passport details before booking flights.`,
          footerText: isBn
            ? 'তোয়া এয়ার ট্রাভেলস • ভিসা প্রসেসিং ডেস্ক'
            : 'Toya Air Travels • Visa Processing Desk',
          variables,
          variableLabels,
          quickReplies: isBn
            ? ['পেয়েছি, ধন্যবাদ', 'টিকিটের কোটেশন দিন']
            : ['Received, thank you', 'Request ticket quote'],
        },
        rcs: {
          cardTitle: isBn
            ? `${route} ভিসা ${visaStatus} • আইডি: ${pnr}`
            : `${route} Visa ${visaStatus} • Ref: ${pnr}`,
          cardDescription: isBn
            ? `হ্যালো ${passengerName}, আপনার ${route} ভিসা (আইডি: ${pnr}) এখন ${visaStatus}।\nমেয়াদ / মন্তব্য: ${validityRemarks}\nনিচের লিংক থেকে ভিসার কপি ডাউনলোড করুন এবং পাসপোর্টের তথ্য যাচাই করুন।`
            : `Hello ${passengerName}, your ${route} visa (ID: ${pnr}) is now ${visaStatus}.\n\nValidity / Remarks: ${validityRemarks}\n\nDownload your visa copy below and verify your passport details before booking flights.`,
          mediaUrl: cdnMediaUrl,
          bannerImageUrl: '/src/assets/images/rcs_flight_banner_1795035420538.jpg',
          verifiedSender: 'Toya Air Travels',
          suggestedActions: [
            {
              type: 'openUrl',
              text: isBn ? 'ভিসা কপি ডাউনলোড (PDF)' : 'Download Visa Copy (PDF)',
              url: shortUrl,
            },
            {
              type: 'reply',
              text: isBn ? 'টিকিটের কোটেশন দিন' : 'Request ticket quote',
            },
            {
              type: 'dial',
              text: isBn ? 'ভিসা ডেস্ক' : 'Visa Desk',
              phoneNumber: SUPPORT_DIAL_NUMBER,
            },
          ],
        },
        sms: {
          text: smsText,
          shortUrl,
          encoding: smsReport.encoding,
          charCount: smsReport.charCount,
          segments: smsReport.segments,
          singleLimit: smsReport.singleLimit,
        },
      },
      metadata,
    };
  }

  // Default: flight_eticket_issued
  const variables = [passengerName, pnr, flightNumber, route, departureTime];
  const variableLabels = [
    '{{1}} Passenger Name',
    '{{2}} PNR',
    '{{3}} Flight Number',
    '{{4}} Route',
    '{{5}} Departure',
  ];
  const smsText = isSmsBn
    ? `তোয়া এয়ার ট্রাভেলস: ${passengerName}-এর ফ্লাইট নিশ্চিত হয়েছে। PNR: ${pnr} (${flightNumber}, ${route}, ${departureTime})। টিকিট ডাউনলোড করুন: ${shortUrl}`
    : `Toya Air Travels: Flight confirmed for ${passengerName}. PNR: ${pnr} (${flightNumber}, ${route} on ${departureTime}). Download e-ticket: ${shortUrl}`;
  const smsReport = analyzeSmsEncoding(smsText);

  return {
    to,
    channelPriority: ['whatsapp', 'rcs', 'sms'],
    fallbackTimeoutSeconds,
    content: {
      whatsapp: {
        templateName: isBn ? 'flight_eticket_issued_bn' : 'flight_eticket_issued',
        templateCategory: 'UTILITY',
        language,
        headerType: 'DOCUMENT',
        headerMediaUrl: cdnMediaUrl,
        headerFilename: pdfFilename,
        bodyText: isBn
          ? `আসসালামু আলাইকুম/নমস্কার ${passengerName}, আপনার বিমানের টিকিট নিশ্চিত করা হয়েছে এবং ই-টিকিটটি উপরে সংযুক্ত করা হলো।\nবুকিংয়ের বিবরণ:\n• পিএনআর / বুকিং কোড: ${pnr}\n• এয়ারলাইন ও ফ্লাইট: ${flightNumber}\n• রুট: ${route}\n• প্রস্থানের সময়: ${departureTime}\nঅনুগ্রহ করে সংযুক্ত টিকিটে যাত্রীর নাম ও পাসপোর্টের বিবরণ ভালোভাবে যাচাই করে নিন এবং কোনো ভুল থাকলে দ্রুত আমাদের জানান।`
          : `Hello ${passengerName}, your flight ticket is confirmed and attached above.\nBooking Details:\n• PNR / Booking Code: ${pnr}\n• Airline & Flight: ${flightNumber}\n• Route: ${route}\n• Departure: ${departureTime}\nPlease verify passenger name and passport details immediately.`,
        footerText: isBn
          ? 'তোয়া এয়ার ট্রাভেলস • কাস্টমার সাপোর্ট'
          : 'Toya Air Travels • Customer Support',
        variables,
        variableLabels,
        quickReplies: isBn
          ? ['তথ্য সঠিক আছে', 'ত্রুটি সংশোধন করুন']
          : ['Details are correct', 'Report a correction'],
      },
      rcs: {
        cardTitle: isBn
          ? `ফ্লাইট ই-টিকিট নিশ্চিত • পিএনআর: ${pnr}`
          : `Flight E-Ticket Confirmed • PNR: ${pnr}`,
        cardDescription: isBn
          ? `যাত্রী: ${passengerName}\nফ্লাইট: ${flightNumber} (${route})\nপ্রস্থান: ${departureTime}\nআপনার ই-টিকিট প্রস্তুত। অনুগ্রহ করে নাম ও পাসপোর্টের তথ্য যাচাই করে নিন।`
          : `Passenger: ${passengerName} Flight: ${flightNumber} (${route}) Departure: ${departureTime}\n\nYour e-ticket is ready. Please verify your name and passport details immediately.`,
        mediaUrl: cdnMediaUrl,
        bannerImageUrl: '/src/assets/images/rcs_flight_banner_1795035420538.jpg',
        verifiedSender: 'Toya Air Travels',
        suggestedActions: [
          {
            type: 'openUrl',
            text: isBn ? 'ই-টিকিট ডাউনলোড (PDF)' : 'Download E-Ticket (PDF)',
            url: shortUrl,
          },
          {
            type: 'reply',
            text: isBn ? 'তথ্য সঠিক আছে' : 'Details are correct',
          },
          {
            type: 'dial',
            text: isBn ? 'সাপোর্ট ডেস্ক' : 'Support Desk',
            phoneNumber: SUPPORT_DIAL_NUMBER,
          },
        ],
      },
      sms: {
        text: smsText,
        shortUrl,
        encoding: smsReport.encoding,
        charCount: smsReport.charCount,
        segments: smsReport.segments,
        singleLimit: smsReport.singleLimit,
      },
    },
    metadata,
  };
}

function seedInitialDispatches(): void {
  const now = Date.now();
  const seeds: Array<{
    id: string;
    minutesAgo: number;
    category: DocumentCategory;
    language: 'en' | 'bn';
    passengerName: string;
    pnr: string;
    flightNumber: string;
    route: string;
    departureTime: string;
    previousTime?: string;
    visaStatus?: string;
    validityRemarks?: string;
    airlineOrEmbassy: string;
    to: string;
    fallbackTimeoutSeconds: number;
    urgentBoarding: boolean;
    conditions: RecipientConditions;
    finalChannel: ChannelId;
    steps: CascadeStepLog[];
    token: string;
  }> = [
    {
      id: 'DSP-88492A',
      minutesAgo: 6,
      category: 'flight_eticket_issued',
      language: 'en',
      passengerName: 'Tariqul Islam',
      pnr: '88492A',
      flightNumber: 'BG-147',
      route: 'DAC-DXB',
      departureTime: '24 Nov 10:30AM',
      airlineOrEmbassy: 'Biman Bangladesh · BG-147',
      to: '+8801700000000',
      fallbackTimeoutSeconds: 20,
      urgentBoarding: false,
      conditions: {
        whatsappActive: true,
        dataConnected: true,
        rcsSupported: true,
        smsReachable: true,
        simulateWhatsAppTimeout: false,
      },
      finalChannel: 'whatsapp',
      token: '88492A',
      steps: [
        {
          priority: 1,
          channel: 'whatsapp',
          state: 'delivered',
          startedAt: new Date(now - 6 * 60000).toISOString(),
          completedAt: new Date(now - 6 * 60000 + 820).toISOString(),
          durationMs: 820,
          detail:
            'Utility template flight_eticket_issued + E-Ticket_PNR88492A.pdf delivered on WhatsApp.',
        },
        {
          priority: 2,
          channel: 'rcs',
          state: 'skipped',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Cascade stopped after primary WhatsApp delivery.',
        },
        {
          priority: 3,
          channel: 'sms',
          state: 'skipped',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Cascade stopped after primary WhatsApp delivery.',
        },
      ],
    },
    {
      id: 'DSP-77219K',
      minutesAgo: 19,
      category: 'flight_schedule_update',
      language: 'bn',
      passengerName: 'Sajjad Hossain',
      pnr: '77219K',
      flightNumber: 'EK-585',
      route: 'DAC-DXB',
      departureTime: '28 Nov 11:30PM',
      previousTime: '09:45PM',
      airlineOrEmbassy: 'Emirates · EK-585',
      to: '+8801713476408',
      fallbackTimeoutSeconds: 10,
      urgentBoarding: true,
      conditions: {
        whatsappActive: true,
        dataConnected: false,
        rcsSupported: false,
        smsReachable: true,
        simulateWhatsAppTimeout: true,
      },
      finalChannel: 'sms',
      token: '77219K',
      steps: [
        {
          priority: 1,
          channel: 'whatsapp',
          state: 'timeout',
          startedAt: new Date(now - 19 * 60000).toISOString(),
          completedAt: new Date(now - 19 * 60000 + 10000).toISOString(),
          durationMs: 10000,
          detail:
            'Passenger offline ahead of departure. Pending flight_schedule_update_bn cancelled at 10s.',
        },
        {
          priority: 2,
          channel: 'rcs',
          state: 'unsupported',
          startedAt: new Date(now - 19 * 60000 + 10000).toISOString(),
          completedAt: new Date(now - 19 * 60000 + 10240).toISOString(),
          durationMs: 240,
          detail: 'Handset offline / lacks RCS data session. Immediate fallback to SMS.',
        },
        {
          priority: 3,
          channel: 'sms',
          state: 'delivered',
          startedAt: new Date(now - 19 * 60000 + 10240).toISOString(),
          completedAt: new Date(now - 19 * 60000 + 11100).toISOString(),
          durationMs: 860,
          detail:
            'GSM-7 schedule alert SMS (139 chars, 1 segment) with desk hotline delivered.',
        },
      ],
    },
    {
      id: 'DSP-9041',
      minutesAgo: 35,
      category: 'visa_application_approved',
      language: 'bn',
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
      urgentBoarding: false,
      conditions: {
        whatsappActive: false,
        dataConnected: true,
        rcsSupported: true,
        smsReachable: true,
        simulateWhatsAppTimeout: false,
      },
      finalChannel: 'rcs',
      token: '9041',
      steps: [
        {
          priority: 1,
          channel: 'whatsapp',
          state: 'unsupported',
          startedAt: new Date(now - 35 * 60000).toISOString(),
          completedAt: new Date(now - 35 * 60000 + 210).toISOString(),
          durationMs: 210,
          detail: 'Recipient phone not active on WhatsApp. Immediate cascade to RCS.',
        },
        {
          priority: 2,
          channel: 'rcs',
          state: 'delivered',
          startedAt: new Date(now - 35 * 60000 + 210).toISOString(),
          completedAt: new Date(now - 35 * 60000 + 1120).toISOString(),
          durationMs: 910,
          detail:
            'Verified Toya Air Travels Bengali RCS rich card with PDF download button delivered.',
        },
        {
          priority: 3,
          channel: 'sms',
          state: 'skipped',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Cascade stopped after RCS rich card delivery.',
        },
      ],
    },
    {
      id: 'DSP-40918',
      minutesAgo: 74,
      category: 'flight_eticket_issued',
      language: 'bn',
      passengerName: 'Nusrat Jahan',
      pnr: 'KSA-40918',
      flightNumber: 'SV-805',
      route: 'DAC-RUH',
      departureTime: '28 Nov 01:15AM',
      airlineOrEmbassy: 'Saudia · SV-805',
      to: '+8801812445566',
      fallbackTimeoutSeconds: 20,
      urgentBoarding: false,
      conditions: {
        whatsappActive: true,
        dataConnected: true,
        rcsSupported: true,
        smsReachable: true,
        simulateWhatsAppTimeout: false,
      },
      finalChannel: 'whatsapp',
      token: '4091',
      steps: [
        {
          priority: 1,
          channel: 'whatsapp',
          state: 'delivered',
          startedAt: new Date(now - 74 * 60000).toISOString(),
          completedAt: new Date(now - 74 * 60000 + 790).toISOString(),
          durationMs: 790,
          detail:
            'Utility template flight_eticket_issued_bn + E-Ticket_PNRKSA-40918.pdf delivered on WhatsApp.',
        },
        {
          priority: 2,
          channel: 'rcs',
          state: 'skipped',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Cascade stopped after primary WhatsApp delivery.',
        },
        {
          priority: 3,
          channel: 'sms',
          state: 'skipped',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Cascade stopped after primary WhatsApp delivery.',
        },
      ],
    },
  ];

  for (const s of seeds) {
    const pdfFilename =
      s.category === 'visa_application_approved'
        ? `Visa_Copy_${s.pnr}.pdf`
        : s.category === 'flight_schedule_update'
          ? `Schedule_Update_${s.pnr}.pdf`
          : `E-Ticket_PNR${s.pnr}.pdf`;
    const createdAt = new Date(now - s.minutesAgo * 60000).toISOString();
    const expiresAt = new Date(now + 72 * 3600 * 1000).toISOString();
    const payload = buildPayload({
      to: s.to,
      category: s.category,
      language: s.language,
      smsLanguage: 'en',
      passengerName: s.passengerName,
      pnr: s.pnr,
      flightNumber: s.flightNumber,
      route: s.route,
      departureTime: s.departureTime,
      previousTime: s.previousTime,
      visaStatus: s.visaStatus,
      validityRemarks: s.validityRemarks,
      fallbackTimeoutSeconds: s.fallbackTimeoutSeconds,
      signedToken: s.token,
      baseUrl: 'https://toya.link',
      pdfFilename,
    });

    const record: DispatchRecord = {
      id: s.id,
      createdAt,
      category: s.category,
      language: s.language,
      smsLanguage: 'en',
      passengerName: s.passengerName,
      pnr: s.pnr,
      flightNumber: s.flightNumber,
      route: s.route,
      departureTime: s.departureTime,
      previousTime: s.previousTime,
      visaStatus: s.visaStatus,
      validityRemarks: s.validityRemarks,
      airlineOrEmbassy: s.airlineOrEmbassy,
      to: s.to,
      fallbackTimeoutSeconds: s.fallbackTimeoutSeconds,
      acceleratedDemo: true,
      urgentBoarding: s.urgentBoarding,
      signedToken: s.token,
      expiresAt,
      shortUrl: `https://toya.link/${s.token}`,
      pdfFilename,
      status: 'delivered',
      finalChannel: s.finalChannel,
      payload,
      conditions: s.conditions,
      steps: s.steps,
    };

    dispatches.set(record.id, record);
    tokenIndex.set(record.signedToken, record.id);
  }
}

function escapePdfText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function generateTicketPdfBuffer(record: DispatchRecord): Buffer {
  const docLabel =
    record.category === 'visa_application_approved'
      ? 'OFFICIAL VISA APPROVAL DOCUMENT'
      : record.category === 'flight_schedule_update'
        ? 'OFFICIAL FLIGHT SCHEDULE UPDATE NOTICE'
        : 'OFFICIAL ELECTRONIC FLIGHT TICKET';

  const lines = [
    'TOYA AIR TRAVELS (KISHOREGANJ)',
    'New Market Road, Sobji Mohol, Katiadi Bazar, Kishoreganj',
    `Hotlines: +8801713-476408 | +8801711-396378 | Desk: ${SUPPORT_DIAL_NUMBER}`,
    '------------------------------------------------------------------------',
    docLabel,
    '------------------------------------------------------------------------',
    `Dispatch ID     : ${record.id}`,
    `Template        : ${record.category}`,
    `Passenger Name  : ${record.passengerName}`,
    `PNR / Reference : ${record.pnr}`,
    `Flight / Visa   : ${record.flightNumber}`,
    `Route / Type    : ${record.route}`,
    record.category === 'flight_schedule_update'
      ? `Previous Time   : ${record.previousTime ?? 'N/A'}`
      : record.category === 'visa_application_approved'
        ? `Visa Status     : ${record.visaStatus ?? 'Approved'}`
        : `Carrier         : ${record.airlineOrEmbassy}`,
    record.category === 'visa_application_approved'
      ? `Validity        : ${record.validityRemarks ?? record.departureTime}`
      : `Departure Time  : ${record.departureTime}`,
    `Recipient Phone : ${record.to}`,
    `Delivery Channel: ${(record.finalChannel ?? 'pending').toUpperCase()}`,
    `Short Link      : ${record.shortUrl}`,
    `Expires At      : ${record.expiresAt}`,
    '------------------------------------------------------------------------',
    'Verified via Unified Messaging Fallback Cascade (WhatsApp -> RCS -> SMS)',
    'Message toyaairbd on WhatsApp: https://wa.me/8801812222277 | Desk: +8801812222277',
  ];

  const streamCommands = ['BT', '/F1 11 Tf', '50 750 Td', '18 TL'];
  lines.forEach((line, idx) => {
    const safe = escapePdfText(line);
    if (idx === 0) {
      streamCommands.push(`(${safe}) Tj`);
    } else {
      streamCommands.push(`T* (${safe}) Tj`);
    }
  });
  streamCommands.push('ET');
  const streamBody = streamCommands.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamBody, 'utf8')} >>\nstream\n${streamBody}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

function runCascadeSimulation(record: DispatchRecord): void {
  const timers: NodeJS.Timeout[] = [];
  activeTimers.set(record.id, timers);

  const scale = record.acceleratedDemo ? 0.12 : 1;
  const waWaitMs = Math.max(900, Math.round(record.fallbackTimeoutSeconds * 1000 * scale));
  const rcsWaitMs = Math.max(800, Math.round(12000 * scale));

  const schedule = (delayMs: number, fn: () => void) => {
    const t = setTimeout(fn, delayMs);
    timers.push(t);
  };

  const waStep = record.steps[0];
  waStep.state = 'checking';
  waStep.startedAt = new Date().toISOString();
  waStep.detail = 'Querying WhatsApp Business API registration & online reachability...';

  schedule(550, () => {
    const cond = record.conditions;
    if (!cond.whatsappActive) {
      waStep.state = 'unsupported';
      waStep.completedAt = new Date().toISOString();
      waStep.durationMs = Date.now() - new Date(waStep.startedAt!).getTime();
      waStep.detail = 'Recipient phone is not registered on WhatsApp. Immediate cascade to RCS.';
      startRcsStage();
      return;
    }

    if (cond.dataConnected && !cond.simulateWhatsAppTimeout) {
      waStep.state = 'delivered';
      waStep.completedAt = new Date().toISOString();
      waStep.durationMs = Date.now() - new Date(waStep.startedAt!).getTime();
      waStep.detail = `Utility template ${record.payload.content.whatsapp.templateName} + ${record.pdfFilename} delivered on WhatsApp.`;
      record.steps[1].state = 'skipped';
      record.steps[1].detail = 'Cascade stopped after primary WhatsApp delivery.';
      record.steps[2].state = 'skipped';
      record.steps[2].detail = 'Cascade stopped after primary WhatsApp delivery.';
      record.finalChannel = 'whatsapp';
      record.status = 'delivered';
      return;
    }

    waStep.state = 'awaiting_ack';
    waStep.detail = `Dispatched WhatsApp utility template ${record.payload.content.whatsapp.templateName}. Awaiting ACK within ${record.fallbackTimeoutSeconds}s...`;

    schedule(waWaitMs, () => {
      waStep.state = 'timeout';
      waStep.completedAt = new Date().toISOString();
      waStep.durationMs = record.fallbackTimeoutSeconds * 1000;
      waStep.detail = `No WhatsApp ACK within ${record.fallbackTimeoutSeconds}s (device offline / no data). Pending state cancelled; cascading to RCS.`;
      startRcsStage();
    });
  });

  function startRcsStage() {
    const rcsStep = record.steps[1];
    rcsStep.state = 'checking';
    rcsStep.startedAt = new Date().toISOString();
    rcsStep.detail = 'Querying carrier & handset RCS Business Messaging capability...';

    schedule(550, () => {
      const cond = record.conditions;
      if (!cond.rcsSupported) {
        rcsStep.state = 'unsupported';
        rcsStep.completedAt = new Date().toISOString();
        rcsStep.durationMs = Date.now() - new Date(rcsStep.startedAt!).getTime();
        rcsStep.detail =
          'Carrier or handset does not support RCS Business Messaging. Immediate fallback to SMS.';
        startSmsStage();
        return;
      }

      if (cond.dataConnected) {
        rcsStep.state = 'delivered';
        rcsStep.completedAt = new Date().toISOString();
        rcsStep.durationMs = Date.now() - new Date(rcsStep.startedAt!).getTime();
        rcsStep.detail = `Verified Toya Air Travels RCS rich card (${record.payload.content.rcs.cardTitle}) delivered.`;
        record.steps[2].state = 'skipped';
        record.steps[2].detail = 'Cascade stopped after RCS rich card delivery.';
        record.finalChannel = 'rcs';
        record.status = 'delivered';
        return;
      }

      rcsStep.state = 'awaiting_ack';
      rcsStep.detail = 'RCS rich card queued. Waiting 12s carrier delivery confirmation...';

      schedule(rcsWaitMs, () => {
        rcsStep.state = 'timeout';
        rcsStep.completedAt = new Date().toISOString();
        rcsStep.durationMs = 12000;
        rcsStep.detail =
          'RCS delivery timed out (no mobile data/Wi-Fi). Cascading to SMS safety net.';
        startSmsStage();
      });
    });
  }

  function startSmsStage() {
    const smsStep = record.steps[2];
    smsStep.state = 'checking';
    smsStep.startedAt = new Date().toISOString();
    smsStep.detail = 'Dispatching plain-text SMS via cellular SS7/SMPP gateway...';

    schedule(650, () => {
      const smsMeta = record.payload.content.sms;
      if (record.conditions.smsReachable) {
        smsStep.state = 'delivered';
        smsStep.completedAt = new Date().toISOString();
        smsStep.durationMs = Date.now() - new Date(smsStep.startedAt!).getTime();
        smsStep.detail = `${smsMeta.encoding} SMS (${smsMeta.charCount}/${smsMeta.singleLimit} chars, ${smsMeta.segments} segment) delivered.`;
        record.finalChannel = 'sms';
        record.status = 'delivered';
      } else {
        smsStep.state = 'timeout';
        smsStep.completedAt = new Date().toISOString();
        smsStep.durationMs = Date.now() - new Date(smsStep.startedAt!).getTime();
        smsStep.detail = 'Cellular carrier unreachable; SMS queued for automatic retry.';
        record.finalChannel = null;
        record.status = 'failed';
      }
    });
  }
}

async function startServer() {
  seedInitialDispatches();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Toya Air Dispatch Cascade Gateway' });
  });

  app.get('/api/contacts', (_req, res) => {
    res.json({ contacts: SAVED_CONTACTS });
  });

  app.post('/api/contacts', (req, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = normalizePhone(body.phone, '');
    if (!name || !phone) {
      res.status(400).json({ error: 'Passenger name and phone number are required.' });
      return;
    }

    const bengaliName =
      typeof body.bengaliName === 'string' && body.bengaliName.trim()
        ? body.bengaliName.trim()
        : name;
    const recentRoute =
      typeof body.recentRoute === 'string' && body.recentRoute.trim()
        ? body.recentRoute.trim()
        : 'DAC-DXB';
    const recentFlight =
      typeof body.recentFlight === 'string' && body.recentFlight.trim()
        ? body.recentFlight.trim()
        : 'BG-147';
    const recentPnr =
      typeof body.recentPnr === 'string' && body.recentPnr.trim()
        ? body.recentPnr.trim().toUpperCase()
        : `TA-${Math.floor(10000 + Math.random() * 90000)}`;

    const newContact: SavedContact = {
      id: `c-${Date.now()}`,
      name,
      bengaliName,
      phone,
      recentRoute,
      recentFlight,
      recentPnr,
      whatsappOptIn: body.whatsappOptIn !== false,
    };

    SAVED_CONTACTS.unshift(newContact);
    res.status(201).json({ contact: newContact });
  });

  app.get('/api/dispatches', (_req, res) => {
    const list = Array.from(dispatches.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ dispatches: list });
  });

  app.get('/api/dispatches/:id', (req, res) => {
    const record = dispatches.get(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Dispatch record not found' });
      return;
    }
    res.json({ dispatch: record });
  });

  app.post('/api/dispatch', (req, res) => {
    const body = req.body ?? {};
    const to = normalizePhone(body.to, '+8801700000000');
    const passengerName =
      typeof body.passengerName === 'string' && body.passengerName.trim()
        ? body.passengerName.trim()
        : 'Tariqul Islam';
    const pnr = typeof body.pnr === 'string' && body.pnr.trim() ? body.pnr.trim() : '88492A';
    const flightNumber =
      typeof body.flightNumber === 'string' && body.flightNumber.trim()
        ? body.flightNumber.trim()
        : 'BG-147';
    const route =
      typeof body.route === 'string' && body.route.trim() ? body.route.trim() : 'DAC-DXB';
    const departureTime =
      typeof body.departureTime === 'string' && body.departureTime.trim()
        ? body.departureTime.trim()
        : '24 Nov 10:30AM';
    const previousTime =
      typeof body.previousTime === 'string' && body.previousTime.trim()
        ? body.previousTime.trim()
        : '09:45PM';
    const visaStatus =
      typeof body.visaStatus === 'string' && body.visaStatus.trim()
        ? body.visaStatus.trim()
        : 'Approved';
    const validityRemarks =
      typeof body.validityRemarks === 'string' && body.validityRemarks.trim()
        ? body.validityRemarks.trim()
        : 'Valid till 18 Jan 27';
    const airlineOrEmbassy =
      typeof body.airlineOrEmbassy === 'string' && body.airlineOrEmbassy.trim()
        ? body.airlineOrEmbassy.trim()
        : 'Biman Bangladesh · BG-147';

    const category: DocumentCategory =
      body.category === 'visa_application_approved' ||
      body.category === 'flight_schedule_update'
        ? body.category
        : 'flight_eticket_issued';

    const language: 'en' | 'bn' = body.language === 'bn' ? 'bn' : 'en';
    const smsLanguage: 'en' | 'bn' = body.smsLanguage === 'bn' ? 'bn' : 'en';

    const fallbackTimeoutSeconds = Math.min(
      60,
      Math.max(5, Number(body.fallbackTimeoutSeconds) || 20)
    );
    const acceleratedDemo = body.acceleratedDemo !== false;
    const urgentBoarding = Boolean(body.urgentBoarding) || fallbackTimeoutSeconds <= 10;

    const conditions: RecipientConditions = {
      whatsappActive: body.conditions?.whatsappActive !== false,
      dataConnected: body.conditions?.dataConnected !== false,
      rcsSupported: body.conditions?.rcsSupported !== false,
      smsReachable: body.conditions?.smsReachable !== false,
      simulateWhatsAppTimeout: Boolean(body.conditions?.simulateWhatsAppTimeout),
    };

    const token = makeShortToken();
    const id = `DSP-${Math.floor(10000 + Math.random() * 90000)}`;
    const pdfFilename =
      category === 'visa_application_approved'
        ? `Visa_Copy_${pnr}.pdf`
        : category === 'flight_schedule_update'
          ? `Schedule_Update_${pnr}.pdf`
          : `E-Ticket_PNR${pnr}.pdf`;
    const baseUrl = `${req.protocol}://${req.get('host') ?? 'localhost:3000'}`;

    const payload = buildPayload({
      to,
      category,
      language,
      smsLanguage,
      passengerName,
      pnr,
      flightNumber,
      route,
      departureTime,
      previousTime,
      visaStatus,
      validityRemarks,
      fallbackTimeoutSeconds,
      signedToken: token,
      baseUrl,
      pdfFilename,
    });

    const record: DispatchRecord = {
      id,
      createdAt: new Date().toISOString(),
      category,
      language,
      smsLanguage,
      passengerName,
      pnr,
      flightNumber,
      route,
      departureTime,
      previousTime,
      visaStatus,
      validityRemarks,
      airlineOrEmbassy,
      to,
      fallbackTimeoutSeconds,
      acceleratedDemo,
      urgentBoarding,
      signedToken: token,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      shortUrl: `https://toya.link/${token}`,
      pdfFilename,
      status: 'in_progress',
      finalChannel: null,
      payload,
      conditions,
      steps: [
        {
          priority: 1,
          channel: 'whatsapp',
          state: 'pending',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Queued as Priority 1 primary channel.',
        },
        {
          priority: 2,
          channel: 'rcs',
          state: 'pending',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Standby Priority 2 channel if WhatsApp fails or times out.',
        },
        {
          priority: 3,
          channel: 'sms',
          state: 'pending',
          startedAt: null,
          completedAt: null,
          durationMs: 0,
          detail: 'Standby Priority 3 guaranteed safety net.',
        },
      ],
    };

    dispatches.set(record.id, record);
    tokenIndex.set(record.signedToken, record.id);
    runCascadeSimulation(record);

    res.status(201).json({ dispatch: record });
  });

  app.get('/api/documents/:token', (req, res) => {
    const dispatchId = tokenIndex.get(req.params.token);
    if (!dispatchId) {
      res.status(404).json({ error: 'Signed document link is invalid or expired.' });
      return;
    }
    const record = dispatches.get(dispatchId);
    if (!record) {
      res.status(404).json({ error: 'Dispatch record not found.' });
      return;
    }
    if (Date.now() > new Date(record.expiresAt).getTime()) {
      res.status(410).json({ error: 'This signed document URL has expired.' });
      return;
    }
    res.json({
      document: {
        id: record.id,
        category: record.category,
        passengerName: record.passengerName,
        pnr: record.pnr,
        flightNumber: record.flightNumber,
        route: record.route,
        departureTime: record.departureTime,
        airlineOrEmbassy: record.airlineOrEmbassy,
        to: record.to,
        pdfFilename: record.pdfFilename,
        signedToken: record.signedToken,
        expiresAt: record.expiresAt,
        finalChannel: record.finalChannel,
        downloadUrl: `/api/documents/${record.signedToken}/download`,
      },
    });
  });

  app.get('/api/documents/:token/download', (req, res) => {
    const dispatchId = tokenIndex.get(req.params.token);
    if (!dispatchId) {
      res.status(404).send('Invalid or expired document token.');
      return;
    }
    const record = dispatches.get(dispatchId);
    if (!record) {
      res.status(404).send('Document not found.');
      return;
    }
    const pdfBuffer = generateTicketPdfBuffer(record);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${record.pdfFilename}"`);
    res.send(pdfBuffer);
  });

  app.post('/api/assistant/chat', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in environment secrets.',
      });
      return;
    }

    const { messages, contactName } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    try {
      const contactContext = contactName
        ? `\nSaved contact selected: "${contactName}". Greet or address them warmly using their name.`
        : '';

      const contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: `${TOYA_SYSTEM_INSTRUCTION}${contactContext}`,
        },
      });

      res.json({
        reply:
          response.text?.trim() ||
          'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে +8801713-476408 নম্বরে যোগাযোগ করুন।',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate assistant response.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/assistant/review-document', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured in environment secrets.',
      });
      return;
    }

    const { fileBase64, mimeType, fileName, note } = req.body ?? {};
    if (!fileBase64 || !mimeType) {
      res.status(400).json({ error: 'Document file data and MIME type are required.' });
      return;
    }

    try {
      const prompt = `Review this uploaded travel document (${fileName || 'document'}). ${note ? `Customer note: ${note}` : ''}
Extract the passenger name, PNR or passport/visa reference number, flight number (if ticket), travel route (or destination/visa type), date, and airline/authority.
Then write a warm, concise response in Bengali (or matching the note language) following Toya Air Travels guidelines: confirm the extracted passenger name and ask how we can assist with that specific service (date change, reissue, visa support, or hotel booking), and direct any pricing/reissue confirmation to WhatsApp +8801713476408.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: String(mimeType),
                data: String(fileBase64),
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction: TOYA_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              documentType: {
                type: Type.STRING,
                description: 'One of flight_ticket, passport, visa_approval, or other',
              },
              passengerName: { type: Type.STRING },
              referenceNumber: { type: Type.STRING },
              flightNumber: { type: Type.STRING },
              route: { type: Type.STRING },
              travelDate: { type: Type.STRING },
              airlineOrAuthority: { type: Type.STRING },
              assistantReply: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({ extracted: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Document review failed.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Toya Air Dispatch server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
