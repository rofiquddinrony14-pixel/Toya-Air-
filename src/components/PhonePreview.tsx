import { useEffect, useState } from 'react';
import {
  Check,
  CheckCheck,
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  Phone,
  Plane,
  Reply,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { ChannelId, DispatchRecord } from '../types/cascade';

interface PhonePreviewProps {
  record: DispatchRecord;
  isLiveDraft?: boolean;
  onToggleLiveDraft?: (useDraft: boolean) => void;
  onOpenDocument: (token: string) => void;
  onQuickReply?: (replyText: string) => void;
}

export function PhonePreview({
  record,
  isLiveDraft = false,
  onToggleLiveDraft,
  onOpenDocument,
  onQuickReply,
}: PhonePreviewProps) {
  const [activeChannel, setActiveChannel] = useState<ChannelId>(
    record.finalChannel ?? 'whatsapp'
  );
  const [imgError, setImgError] = useState(false);
  const [postbackAck, setPostbackAck] = useState<string | null>(null);

  useEffect(() => {
    if (record.finalChannel) {
      setActiveChannel(record.finalChannel);
    }
    setPostbackAck(null);
  }, [record.id, record.finalChannel]);

  const { whatsapp, rcs, sms } = record.payload.content;
  const waStep = record.steps.find((s) => s.channel === 'whatsapp');
  const rcsStep = record.steps.find((s) => s.channel === 'rcs');
  const smsStep = record.steps.find((s) => s.channel === 'sms');

  const handleReplyClick = (text: string) => {
    setPostbackAck(`Postback sent: "${text}"`);
    onQuickReply?.(text);
  };

  return (
    <div className="flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 text-slate-600 shrink-0" />
            <span className="text-sm font-semibold text-slate-900 truncate">
              Handset Preview
            </span>
          </div>

          {onToggleLiveDraft && (
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md shrink-0">
              <button
                type="button"
                onClick={() => onToggleLiveDraft(false)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !isLiveDraft
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dispatched
              </button>
              <button
                type="button"
                onClick={() => onToggleLiveDraft(true)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isLiveDraft
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Draft
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg shrink-0">
          {(['whatsapp', 'rcs', 'sms'] as ChannelId[]).map((ch) => {
            const label = ch === 'whatsapp' ? 'WhatsApp' : ch === 'rcs' ? 'RCS' : 'SMS';
            const isActive = activeChannel === ch;
            const isWinner = record.finalChannel === ch;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setActiveChannel(ch)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
                {isWinner ? ' · Sent' : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-slate-100/70 flex justify-center">
        <div className="w-full max-w-[356px] rounded-[24px] border border-slate-300 bg-white overflow-hidden">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-5 py-2 bg-slate-900 text-white text-[11px] font-mono tabular-nums">
            <span>10:32</span>
            <span className="text-slate-300 truncate max-w-[150px]">{record.to}</span>
            <span>{record.conditions.dataConnected ? '4G+' : 'GSM'}</span>
          </div>

          {activeChannel === 'whatsapp' && (
            <div className="flex flex-col bg-[#efeae2] min-h-[410px]">
              {/* WhatsApp Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#075e54] text-white">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-teal-700 border border-white/20 flex items-center justify-center text-xs font-semibold shrink-0">
                    TA
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-sm font-semibold leading-tight truncate">
                      <span className="truncate">Toya Air Travels</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    </div>
                    <div className="text-[11px] text-emerald-100/80 truncate">
                      Utility · {whatsapp.templateName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Area */}
              <div className="p-3 space-y-2.5 flex-1">
                {waStep?.state === 'timeout' || waStep?.state === 'unsupported' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
                    <div className="font-semibold">
                      {waStep.state === 'unsupported'
                        ? 'WhatsApp Unavailable'
                        : 'WhatsApp Timeout Reached'}
                    </div>
                    <p className="mt-0.5 text-amber-800 leading-relaxed">
                      {waStep.detail}
                    </p>
                  </div>
                ) : null}

                <div className="bg-white rounded-lg rounded-tl-none p-2.5 shadow-2xs border border-black/5 space-y-2">
                  {/* PDF Header Media Attachment or Text Header */}
                  {whatsapp.headerType === 'DOCUMENT' ? (
                    <button
                      type="button"
                      onClick={() => onOpenDocument(record.signedToken)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {whatsapp.headerFilename}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          PDF Attachment · Utility Header
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-slate-500 shrink-0" />
                    </button>
                  ) : (
                    whatsapp.headerText && (
                      <div className="text-xs font-semibold text-slate-900 pb-1 border-b border-slate-100">
                        {whatsapp.headerText}
                      </div>
                    )
                  )}

                  <div className="text-[12px] leading-relaxed text-slate-800 whitespace-pre-line">
                    {whatsapp.bodyText}
                  </div>

                  <div className="pt-1 border-t border-slate-100 text-[10.5px] text-slate-500">
                    {whatsapp.footerText}
                  </div>

                  <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-400">
                    <span className="font-mono">
                      {whatsapp.templateName} ({whatsapp.language})
                    </span>
                    <span className="flex items-center gap-1 font-mono tabular-nums">
                      10:32 AM
                      {waStep?.state === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-600" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </span>
                  </div>
                </div>

                {/* Quick Reply & Phone Buttons */}
                <div className="space-y-1.5">
                  {whatsapp.quickReplies.map((reply) =>
                    reply.includes('+8801812222277') ? (
                      <a
                        key={reply}
                        href="tel:+8801812222277"
                        className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-[#027eb5] text-xs font-medium rounded-lg border border-black/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{reply}</span>
                      </a>
                    ) : (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => handleReplyClick(reply)}
                        className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-[#027eb5] text-xs font-medium rounded-lg border border-black/10 transition-colors cursor-pointer"
                      >
                        {reply}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {activeChannel === 'rcs' && (
            <div className="flex flex-col bg-slate-50 min-h-[410px]">
              {/* Google Messages RCS Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
                    TA
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-900 truncate">
                      <span>{rcs.verifiedSender}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    </div>
                    <div className="text-[10px] text-slate-500">
                      RCS Business Messaging · Verified
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 space-y-3 flex-1">
                {rcsStep?.state === 'unsupported' || rcsStep?.state === 'timeout' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
                    <div className="font-semibold">RCS Fallback Triggered</div>
                    <p className="mt-0.5 text-amber-800">{rcsStep.detail}</p>
                  </div>
                ) : null}

                {/* Rich Card */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="relative h-28 w-full bg-slate-800 overflow-hidden">
                    {!imgError ? (
                      <img
                        src={rcs.bannerImageUrl}
                        alt="Toya Air Travels flight wing over clouds"
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 to-teal-900 flex items-center justify-center text-white/80">
                        <Plane className="w-7 h-7" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3 text-white">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-teal-200">
                        Toya Air Travels · Verified
                      </div>
                      <div className="text-xs font-semibold truncate">
                        {record.route}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="text-sm font-semibold text-slate-900 leading-snug">
                      {rcs.cardTitle}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {rcs.cardDescription}
                    </p>
                  </div>

                  {/* RCS Suggested Actions (Open URL / Postback Reply / Dial Phone) */}
                  <div className="border-t border-slate-200 divide-y divide-slate-200">
                    {rcs.suggestedActions.map((action, idx) => {
                      if (action.type === 'openUrl') {
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onOpenDocument(record.signedToken)}
                            className="w-full py-2.5 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50/70 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{action.text}</span>
                          </button>
                        );
                      }
                      if (action.type === 'dial') {
                        return (
                          <a
                            key={idx}
                            href={`tel:${action.phoneNumber ?? '+8801812222277'}`}
                            className="w-full py-2.5 px-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              {action.text} · {action.phoneNumber}
                            </span>
                          </a>
                        );
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleReplyClick(action.text)}
                          className="w-full py-2.5 px-3 flex items-center justify-center gap-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50/70 transition-colors cursor-pointer"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          <span>{action.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {postbackAck && (
                  <div className="text-[11px] font-mono text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                    {postbackAck}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeChannel === 'sms' && (
            <div className="flex flex-col bg-white min-h-[410px]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">TOYA AIR</div>
                    <div className="text-[10px] text-slate-500">
                      Text Message · {sms.encoding}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-mono tabular-nums ${
                    sms.segments === 1 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {sms.charCount}/{sms.singleLimit} · {sms.segments} seg
                </span>
              </div>

              <div className="p-4 space-y-3 flex-1 bg-slate-50/60">
                <div className="text-center text-[10px] text-slate-400 font-mono">
                  Today · 10:32 AM
                </div>

                <div className="bg-slate-200/80 text-slate-900 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[12.5px] leading-relaxed space-y-2 max-w-[94%]">
                  <p className="break-words">{sms.text}</p>
                  {record.category !== 'flight_schedule_update' && (
                    <button
                      type="button"
                      onClick={() => onOpenDocument(record.signedToken)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 underline underline-offset-2 cursor-pointer"
                    >
                      <span>Open {record.shortUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 bg-white rounded-lg p-2.5 text-[11px] text-slate-600 space-y-1 font-mono tabular-nums">
                  <div className="flex items-center justify-between">
                    <span>Encoding</span>
                    <span
                      className={
                        sms.encoding === 'GSM-7' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
                      }
                    >
                      {sms.encoding}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Short Link Length</span>
                    <span>{record.shortUrl.length} chars</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>SMS Segments</span>
                    <span>
                      {sms.segments} ({sms.charCount} / {sms.singleLimit} limit)
                    </span>
                  </div>
                </div>

                {smsStep?.state === 'delivered' && (
                  <div className="text-[11px] text-slate-500 px-1">
                    Delivered via cellular safety net without mobile data.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
