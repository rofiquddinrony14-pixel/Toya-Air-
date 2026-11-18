import type { DispatchDraft } from '../components/DispatchWorkbench';
import type { DispatchRecord } from '../types/cascade';
import { analyzeSmsEncoding } from './gsm7';

export function buildDraftPreviewRecord(draft: DispatchDraft): DispatchRecord {
  const shortToken = 'DRAFT';
  const shortUrl = `https://toya.link/${shortToken}`;
  const isBn = draft.language === 'bn';
  const isSmsBn = draft.smsLanguage === 'bn';

  const pdfFilename =
    draft.category === 'visa_application_approved'
      ? `Visa_Copy_${draft.pnr || 'REF'}.pdf`
      : draft.category === 'flight_schedule_update'
        ? `Schedule_Update_${draft.pnr || 'PNR'}.pdf`
        : `E-Ticket_PNR${draft.pnr || 'PNR'}.pdf`;

  const cdnMediaUrl =
    draft.category === 'visa_application_approved'
      ? `https://cdn.toyaairbd.com/visas/${draft.pnr || 'REF'}.pdf`
      : `https://cdn.toyaairbd.com/tickets/PNR-${draft.pnr || 'PNR'}.pdf`;

  const metadata = {
    agency: 'Toya Air Travels',
    branch: 'Katiadi Bazar, Kishoreganj',
    bookingRef: draft.pnr || '88492A',
    documentType:
      draft.category === 'visa_application_approved'
        ? ('visa_approval' as const)
        : draft.category === 'flight_schedule_update'
          ? ('schedule_update' as const)
          : ('eticket' as const),
  };

  let whatsapp: DispatchRecord['payload']['content']['whatsapp'];
  let rcs: DispatchRecord['payload']['content']['rcs'];
  let smsText: string;

  if (draft.category === 'flight_schedule_update') {
    smsText = isSmsBn
      ? `তোয়া এয়ার ট্রাভেলস: ফ্লাইট ${draft.flightNumber} (PNR ${draft.pnr}) পুনঃনির্ধারিত হয়েছে। নতুন সময়: ${draft.departureTime} (পূর্বের সময় ${draft.previousTime})। সহায়তার জন্য কল করুন +8801812222277`
      : `ALERT Toya Air Travels: Flight ${draft.flightNumber} (PNR ${draft.pnr}) rescheduled. New departure: ${draft.departureTime} (was ${draft.previousTime}). Need help? Call +8801812222277`;

    whatsapp = {
      templateName: isBn ? 'flight_schedule_update_bn' : 'flight_schedule_update',
      templateCategory: 'UTILITY',
      language: draft.language,
      headerType: 'TEXT',
      headerText: isBn ? 'জরুরি ফ্লাইট সময়সূচী আপডেট' : 'Urgent Flight Schedule Update',
      bodyText: isBn
        ? `প্রিয় ${draft.passengerName}, এয়ারলাইন কতৃপক্ষ আপনার আসন্ন ফ্লাইটের সময়সূচীতে পরিবর্তন এনেছে (পিএনআর: ${draft.pnr})।\n• ফ্লাইট: ${draft.flightNumber} (${draft.route})\n• পূর্বের সময়: ${draft.previousTime}\n• নতুন প্রস্থানের সময়: ${draft.departureTime}\nপরিবর্তিত সময় অনুযায়ী বিমানবন্দর গমনের প্রস্তুতি নিন। রি-বুকিং বা সংযোগকারী ফ্লাইটের সহায়তার জন্য নিচের বাটনে যোগাযোগ করুন।`
        : `Dear ${draft.passengerName}, the airline has updated the schedule for your upcoming flight (PNR: ${draft.pnr}).\n• Flight: ${draft.flightNumber} (${draft.route})\n• Previous Time: ${draft.previousTime}\n• New Departure: ${draft.departureTime}\nPlease plan your airport arrival based on the updated schedule.`,
      footerText: isBn
        ? 'তোয়া এয়ার ট্রাভেলস • অটোমেটেড ফ্লাইট অ্যালার্ট'
        : 'Toya Air Travels • Automated Flight Alert',
      variables: [
        draft.passengerName,
        draft.pnr,
        draft.flightNumber,
        draft.route,
        draft.previousTime,
        draft.departureTime,
      ],
      variableLabels: [
        '{{1}} Passenger Name',
        '{{2}} PNR',
        '{{3}} Flight Number',
        '{{4}} Route',
        '{{5}} Previous Time',
        '{{6}} New Departure',
      ],
      quickReplies: isBn
        ? ['নতুন সময় বুঝে পেয়েছি', 'ট্রাভেল ডেস্কে কল করুন (+8801812222277)']
        : ['Acknowledge new time', 'Call Travel Desk (+8801812222277)'],
    };

    rcs = {
      cardTitle: isBn
        ? `সময়সূচী আপডেট: ${draft.flightNumber} (পিএনআর: ${draft.pnr})`
        : `Schedule Update: ${draft.flightNumber} (PNR: ${draft.pnr})`,
      cardDescription: isBn
        ? `প্রিয় ${draft.passengerName}, আপনার ফ্লাইটটি (${draft.route}) এয়ারলাইন কতৃপক্ষ পুনঃনির্ধারণ করেছে।\n• পূর্বের সময়: ${draft.previousTime}\n• নতুন প্রস্থান: ${draft.departureTime}`
        : `Dear ${draft.passengerName}, your flight (${draft.route}) has been rescheduled by the airline.\n\n• Previous Time: ${draft.previousTime} • New Departure: ${draft.departureTime}`,
      mediaUrl: cdnMediaUrl,
      bannerImageUrl: '/src/assets/images/rcs_flight_banner_1795035420538.jpg',
      verifiedSender: 'Toya Air Travels',
      suggestedActions: [
        { type: 'reply', text: isBn ? 'নতুন সময় বুঝে পেয়েছি' : 'Acknowledge new time' },
        { type: 'dial', text: isBn ? 'ট্রাভেল ডেস্ক' : 'Call Travel Desk', phoneNumber: '+8801812222277' },
      ],
    };
  } else if (draft.category === 'visa_application_approved') {
    smsText = isSmsBn
      ? `তোয়া এয়ার ট্রাভেলস: ${draft.passengerName}, আপনার ${draft.route} ভিসা (${draft.pnr}) ${draft.visaStatus} (${draft.validityRemarks})। কপি ডাউনলোড করুন: ${shortUrl}`
      : `Toya Air Travels: ${draft.passengerName}, your ${draft.route} visa (${draft.pnr}) is ${draft.visaStatus} (${draft.validityRemarks}). Download copy: ${shortUrl}`;

    whatsapp = {
      templateName: isBn ? 'visa_application_approved_bn' : 'visa_application_approved',
      templateCategory: 'UTILITY',
      language: draft.language,
      headerType: 'DOCUMENT',
      headerMediaUrl: cdnMediaUrl,
      headerFilename: pdfFilename,
      bodyText: isBn
        ? `আসসালামু আলাইকুম/নমস্কার ${draft.passengerName}, আপনার ${draft.route} ভিসা আবেদন সম্পর্কে একটি আপডেট রয়েছে (আবেদন আইডি: ${draft.pnr})।\n• বর্তমান অবস্থা: ${draft.visaStatus}\n• ভিসার মেয়াদ / মন্তব্য: ${draft.validityRemarks}\nআপনার ভিসার কপি এই বার্তার সাথে সংযুক্ত করা হয়েছে। ভ্রমণের তারিখ চূড়ান্ত করার আগে পাসপোর্টের তথ্য মিলিয়ে নিন।`
        : `Hello ${draft.passengerName}, there is an update regarding your ${draft.route} visa application (ID: ${draft.pnr}).\n• Current Status: ${draft.visaStatus}\n• Validity / Remarks: ${draft.validityRemarks}\nYour visa copy is attached above. Please verify your passport details before booking flights.`,
      footerText: isBn
        ? 'তোয়া এয়ার ট্রাভেলস • ভিসা প্রসেসিং ডেস্ক'
        : 'Toya Air Travels • Visa Processing Desk',
      variables: [
        draft.passengerName,
        draft.route,
        draft.pnr,
        draft.visaStatus,
        draft.validityRemarks,
      ],
      variableLabels: [
        '{{1}} Applicant Name',
        '{{2}} Country / Visa Type',
        '{{3}} Visa ID / Ref',
        '{{4}} Status',
        '{{5}} Validity / Remarks',
      ],
      quickReplies: isBn
        ? ['পেয়েছি, ধন্যবাদ', 'টিকিটের কোটেশন দিন']
        : ['Received, thank you', 'Request ticket quote'],
    };

    rcs = {
      cardTitle: isBn
        ? `${draft.route} ভিসা ${draft.visaStatus} • আইডি: ${draft.pnr}`
        : `${draft.route} Visa ${draft.visaStatus} • Ref: ${draft.pnr}`,
      cardDescription: isBn
        ? `হ্যালো ${draft.passengerName}, আপনার ${draft.route} ভিসা (আইডি: ${draft.pnr}) এখন ${draft.visaStatus}।\nমেয়াদ / মন্তব্য: ${draft.validityRemarks}`
        : `Hello ${draft.passengerName}, your ${draft.route} visa (ID: ${draft.pnr}) is now ${draft.visaStatus}.\n\nValidity / Remarks: ${draft.validityRemarks}`,
      mediaUrl: cdnMediaUrl,
      bannerImageUrl: '/src/assets/images/rcs_flight_banner_1795035420538.jpg',
      verifiedSender: 'Toya Air Travels',
      suggestedActions: [
        { type: 'openUrl', text: isBn ? 'ভিসা কপি ডাউনলোড (PDF)' : 'Download Visa Copy (PDF)', url: shortUrl },
        { type: 'reply', text: isBn ? 'টিকিটের কোটেশন দিন' : 'Request ticket quote' },
        { type: 'dial', text: isBn ? 'ভিসা ডেস্ক' : 'Visa Desk', phoneNumber: '+8801812222277' },
      ],
    };
  } else {
    smsText = isSmsBn
      ? `তোয়া এয়ার ট্রাভেলস: ${draft.passengerName}-এর ফ্লাইট নিশ্চিত হয়েছে। PNR: ${draft.pnr} (${draft.flightNumber}, ${draft.route}, ${draft.departureTime})। টিকিট ডাউনলোড করুন: ${shortUrl}`
      : `Toya Air Travels: Flight confirmed for ${draft.passengerName}. PNR: ${draft.pnr} (${draft.flightNumber}, ${draft.route} on ${draft.departureTime}). Download e-ticket: ${shortUrl}`;

    whatsapp = {
      templateName: isBn ? 'flight_eticket_issued_bn' : 'flight_eticket_issued',
      templateCategory: 'UTILITY',
      language: draft.language,
      headerType: 'DOCUMENT',
      headerMediaUrl: cdnMediaUrl,
      headerFilename: pdfFilename,
      bodyText: isBn
        ? `আসসালামু আলাইকুম/নমস্কার ${draft.passengerName}, আপনার বিমানের টিকিট নিশ্চিত করা হয়েছে এবং ই-টিকিটটি উপরে সংযুক্ত করা হলো।\nবুকিংয়ের বিবরণ:\n• পিএনআর / বুকিং কোড: ${draft.pnr}\n• এয়ারলাইন ও ফ্লাইট: ${draft.flightNumber}\n• রুট: ${draft.route}\n• প্রস্থানের সময়: ${draft.departureTime}\nঅনুগ্রহ করে সংযুক্ত টিকিটে যাত্রীর নাম ও পাসপোর্টের বিবরণ ভালোভাবে যাচাই করে নিন এবং কোনো ভুল থাকলে দ্রুত আমাদের জানান।`
        : `Hello ${draft.passengerName}, your flight ticket is confirmed and attached above.\nBooking Details:\n• PNR / Booking Code: ${draft.pnr}\n• Airline & Flight: ${draft.flightNumber}\n• Route: ${draft.route}\n• Departure: ${draft.departureTime}\nPlease verify passenger name and passport details immediately.`,
      footerText: isBn
        ? 'তোয়া এয়ার ট্রাভেলস • কাস্টমার সাপোর্ট'
        : 'Toya Air Travels • Customer Support',
      variables: [
        draft.passengerName,
        draft.pnr,
        draft.flightNumber,
        draft.route,
        draft.departureTime,
      ],
      variableLabels: [
        '{{1}} Passenger Name',
        '{{2}} PNR',
        '{{3}} Flight Number',
        '{{4}} Route',
        '{{5}} Departure',
      ],
      quickReplies: isBn
        ? ['তথ্য সঠিক আছে', 'ত্রুটি সংশোধন করুন']
        : ['Details are correct', 'Report a correction'],
    };

    rcs = {
      cardTitle: isBn
        ? `ফ্লাইট ই-টিকিট নিশ্চিত • পিএনআর: ${draft.pnr}`
        : `Flight E-Ticket Confirmed • PNR: ${draft.pnr}`,
      cardDescription: isBn
        ? `যাত্রী: ${draft.passengerName}\nফ্লাইট: ${draft.flightNumber} (${draft.route})\nপ্রস্থান: ${draft.departureTime}`
        : `Passenger: ${draft.passengerName} Flight: ${draft.flightNumber} (${draft.route}) Departure: ${draft.departureTime}\n\nYour e-ticket is ready. Please verify your name and passport details immediately.`,
      mediaUrl: cdnMediaUrl,
      bannerImageUrl: '/src/assets/images/rcs_flight_banner_1795035420538.jpg',
      verifiedSender: 'Toya Air Travels',
      suggestedActions: [
        { type: 'openUrl', text: isBn ? 'ই-টিকিট ডাউনলোড (PDF)' : 'Download E-Ticket (PDF)', url: shortUrl },
        { type: 'reply', text: isBn ? 'তথ্য সঠিক আছে' : 'Details are correct' },
        { type: 'dial', text: isBn ? 'সাপোর্ট ডেস্ক' : 'Support Desk', phoneNumber: '+8801812222277' },
      ],
    };
  }

  const smsAnalysis = analyzeSmsEncoding(smsText);

  return {
    id: 'LIVE-DRAFT',
    createdAt: new Date().toISOString(),
    category: draft.category,
    language: draft.language,
    smsLanguage: draft.smsLanguage,
    passengerName: draft.passengerName,
    pnr: draft.pnr,
    flightNumber: draft.flightNumber,
    route: draft.route,
    departureTime: draft.departureTime,
    previousTime: draft.previousTime,
    visaStatus: draft.visaStatus,
    validityRemarks: draft.validityRemarks,
    airlineOrEmbassy: draft.airlineOrEmbassy,
    to: draft.to,
    fallbackTimeoutSeconds: draft.fallbackTimeoutSeconds,
    acceleratedDemo: draft.acceleratedDemo,
    urgentBoarding: draft.fallbackTimeoutSeconds <= 10,
    signedToken: shortToken,
    expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    shortUrl,
    pdfFilename,
    status: 'delivered',
    finalChannel: null,
    conditions: draft.conditions,
    steps: [],
    payload: {
      to: draft.to,
      channelPriority: ['whatsapp', 'rcs', 'sms'],
      fallbackTimeoutSeconds: draft.fallbackTimeoutSeconds,
      content: {
        whatsapp,
        rcs,
        sms: {
          text: smsText,
          shortUrl,
          encoding: smsAnalysis.encoding,
          charCount: smsAnalysis.charCount,
          segments: smsAnalysis.segments,
          singleLimit: smsAnalysis.singleLimit,
        },
      },
      metadata,
    },
  };
}
