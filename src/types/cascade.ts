export type ChannelId = 'whatsapp' | 'rcs' | 'sms';

export type TemplateLanguage = 'en' | 'bn';

export type DocumentCategory =
  | 'flight_eticket_issued'
  | 'flight_schedule_update'
  | 'visa_application_approved';

export type StepState =
  | 'pending'
  | 'checking'
  | 'awaiting_ack'
  | 'delivered'
  | 'timeout'
  | 'unsupported'
  | 'cancelled'
  | 'skipped';

export interface RecipientConditions {
  whatsappActive: boolean;
  dataConnected: boolean;
  rcsSupported: boolean;
  smsReachable: boolean;
  simulateWhatsAppTimeout: boolean;
}

export interface WhatsAppContent {
  templateName: string;
  templateCategory: 'UTILITY';
  language: TemplateLanguage;
  headerType: 'DOCUMENT' | 'TEXT';
  headerText?: string;
  headerMediaUrl?: string;
  headerFilename?: string;
  bodyText: string;
  footerText: string;
  variables: string[];
  variableLabels: string[];
  quickReplies: string[];
}

export interface RcsSuggestedAction {
  type: 'openUrl' | 'reply' | 'dial';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface RcsContent {
  cardTitle: string;
  cardDescription: string;
  mediaUrl: string;
  bannerImageUrl: string;
  verifiedSender: string;
  suggestedActions: RcsSuggestedAction[];
}

export interface SmsContent {
  text: string;
  shortUrl: string;
  encoding: 'GSM-7' | 'UCS-2';
  charCount: number;
  segments: number;
  singleLimit: number;
}

export interface DispatchMetadata {
  agency: string;
  branch: string;
  bookingRef: string;
  documentType: 'eticket' | 'schedule_update' | 'visa_approval';
}

export interface UnifiedDispatchPayload {
  to: string;
  channelPriority: ChannelId[];
  fallbackTimeoutSeconds: number;
  content: {
    whatsapp: WhatsAppContent;
    rcs: RcsContent;
    sms: SmsContent;
  };
  metadata: DispatchMetadata;
}

export interface CascadeStepLog {
  priority: number;
  channel: ChannelId;
  state: StepState;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  detail: string;
}

export interface DispatchRecord {
  id: string;
  createdAt: string;
  category: DocumentCategory;
  language: TemplateLanguage;
  smsLanguage: TemplateLanguage;
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
  acceleratedDemo: boolean;
  urgentBoarding: boolean;
  signedToken: string;
  expiresAt: string;
  shortUrl: string;
  pdfFilename: string;
  status: 'in_progress' | 'delivered' | 'failed';
  finalChannel: ChannelId | null;
  payload: UnifiedDispatchPayload;
  conditions: RecipientConditions;
  steps: CascadeStepLog[];
}

export interface SavedContact {
  id: string;
  name: string;
  bengaliName: string;
  phone: string;
  recentRoute: string;
  recentFlight: string;
  recentPnr: string;
  whatsappOptIn: boolean;
}

export interface ExtractedDocumentInfo {
  documentType: 'flight_ticket' | 'passport' | 'visa_approval' | 'other';
  passengerName: string;
  referenceNumber: string;
  flightNumber?: string;
  route: string;
  travelDate: string;
  airlineOrAuthority: string;
  assistantReply: string;
}
