import { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  FileUp,
  MapPin,
  Phone,
  Search,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import type { ExtractedDocumentInfo, SavedContact } from '../types/cascade';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  extracted?: ExtractedDocumentInfo;
}

interface ToyaTravelDeskProps {
  contacts: SavedContact[];
  initialPrompt: string | null;
  onConsumeInitialPrompt: () => void;
  onLoadExtractedToDispatcher: (info: ExtractedDocumentInfo, phone?: string) => void;
}

export function ToyaTravelDesk({
  contacts,
  initialPrompt,
  onConsumeInitialPrompt,
  onLoadExtractedToDispatcher,
}: ToyaTravelDeskProps) {
  const [selectedContact, setSelectedContact] = useState<SavedContact | null>(
    contacts[0] ?? null
  );
  const [messages, setMessages] = useState<ChatTurn[]>(() => [
    {
      id: 'welcome-1',
      role: 'assistant',
      content: contacts[0]
        ? `হ্যালো ${contacts[0].bengaliName} (${contacts[0].name}), কেমন আছেন? তোয়া এয়ার ট্রাভেলস (কটিয়াদী বাজার, কিশোরগঞ্জ)-এ আপনাকে স্বাগতম। টিকিট বুকিং, ডেট চেঞ্জ, রি-ইস্যু, ভিসা বা আমাদের অফিসের ঠিকানার ব্যাপারে কীভাবে সাহায্য করতে পারি?`
        : 'আসসালামু আলাইকুম! তোয়া এয়ার ট্রাভেলস (কটিয়াদী বাজার, কিশোরগঞ্জ)-এ আপনাকে স্বাগতম। টিকিট, ভিসা, ডেট চেঞ্জ বা অফিসের ঠিকানার বিষয়ে কীভাবে সাহায্য করতে পারি?',
    },
  ]);
  const [input, setInput] = useState(initialPrompt ?? '');
  const [contactQuery, setContactQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contacts;
    const normalizedDigits = q.replace(/[\s\-()]/g, '');

    return contacts.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const bengaliMatch = c.bengaliName.toLowerCase().includes(q);
      const pnrMatch = c.recentPnr.toLowerCase().includes(q);
      const phoneLower = c.phone.toLowerCase();
      const phoneDigits = phoneLower.replace(/[\s\-()]/g, '');
      const phoneMatch =
        phoneLower.includes(q) ||
        (normalizedDigits.length > 0 && phoneDigits.includes(normalizedDigits));

      return nameMatch || bengaliMatch || pnrMatch || phoneMatch;
    });
  }, [contacts, contactQuery]);

  if (initialPrompt && input !== initialPrompt) {
    setInput(initialPrompt);
    onConsumeInitialPrompt();
  } else if (initialPrompt) {
    onConsumeInitialPrompt();
  }

  const handleSwitchContact = (contact: SavedContact) => {
    setSelectedContact(contact);
    setMessages([
      {
        id: `greet-${contact.id}-${Date.now()}`,
        role: 'assistant',
        content: `হ্যালো ${contact.bengaliName} (${contact.name}), কেমন আছেন? তোয়া এয়ার ট্রাভেলসে আপনাকে স্বাগতম। আপনার ${contact.recentRoute} (PNR: ${contact.recentPnr}) অথবা নতুন কোনো ভ্রমণ সেবার জন্য কীভাবে সাহায্য করতে পারি?`,
      },
    ]);
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const nextHistory = [...messages, userTurn];
    setMessages(nextHistory);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: selectedContact
            ? `${selectedContact.bengaliName} (${selectedContact.name})`
            : undefined,
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Assistant unavailable.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach assistant. Please call +8801713-476408.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const commaIndex = result.indexOf(',');
          resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read uploaded file.'));
        reader.readAsDataURL(file);
      });

      const userTurn: ChatTurn = {
        id: `doc-u-${Date.now()}`,
        role: 'user',
        content: `ডকুমেন্ট রিভিউয়ের জন্য আপলোড করা হয়েছে: ${file.name}`,
      };
      setMessages((prev) => [...prev, userTurn]);

      const res = await fetch('/api/assistant/review-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
          note: selectedContact
            ? `Customer name on file: ${selectedContact.name}`
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Document review failed.');
      }

      const extracted: ExtractedDocumentInfo = data.extracted;
      setMessages((prev) => [
        ...prev,
        {
          id: `doc-a-${Date.now()}`,
          role: 'assistant',
          content:
            extracted.assistantReply ||
            `${extracted.passengerName || 'যাত্রী'}-এর ডকুমেন্টটি যাচাই করা হয়েছে। কোন সেবার জন্য সহায়তা লাগবে জানাবেন।`,
          extracted,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document inspection failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar Info: Agency Details & Saved Contacts */}
      <div className="lg:col-span-4 space-y-6">
        <section className="border border-slate-200 bg-white rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0 font-display font-bold text-sm">
              TA
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Toya Air Travels (তোয়া এয়ার ট্রাভেলস)
              </h2>
              <p className="text-xs text-slate-500">
                Proprietor: Rofiq Uddin Rony
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>
                নিউ মার্কেট রোড, সবজি মহল, কটিয়াদী বাজার, কিশোরগঞ্জ
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <Phone className="w-4 h-4 text-teal-700 shrink-0" />
              <span>+8801713-476408 · +8801711-396378</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
              <span>toyaairtravelsbd@gmail.com · www.toyaairbd.com</span>
            </div>
          </div>

          <div className="space-y-2">
            <a
              href="https://wa.me/8801812222277"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Message toyaairbd on WhatsApp</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://wa.me/+8801713476408"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Hotline WhatsApp (+8801713476408)</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        <section className="border border-slate-200 bg-white rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 text-xs font-semibold text-slate-800">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-500" />
              <span>Saved Customer Context</span>
            </div>
            <span className="text-[11px] font-mono font-normal text-slate-500 tabular-nums">
              {filteredContacts.length} of {contacts.length}
            </span>
          </div>
          <div className="px-3 py-2.5 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search name, phone, or PNR..."
                aria-label="Search saved passengers by name, phone, or PNR"
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-colors"
              />
              {contactQuery && (
                <button
                  type="button"
                  onClick={() => setContactQuery('')}
                  aria-label="Clear passenger search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-200 max-h-[340px] overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="px-4 py-6 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  No passengers match &ldquo;{contactQuery.trim()}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => setContactQuery('')}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 underline underline-offset-2 cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredContacts.map((c) => {
                const active = selectedContact?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSwitchContact(c)}
                    className={`w-full px-4 py-3 text-left transition-colors cursor-pointer ${
                      active ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        {c.bengaliName} · {c.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {c.recentPnr}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
                      {c.phone} · {c.recentRoute}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Right Chat & Ticket/Passport Reviewer */}
      <div className="lg:col-span-8 border border-slate-200 bg-white rounded-xl overflow-hidden flex flex-col min-h-[560px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Toya Travel Desk & Document Reviewer
            </h3>
            <p className="text-xs text-slate-500">
              Handles Bengali/English inquiries, Kishoreganj route guidance, and ticket/passport inspection.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5 text-teal-700" />
              <span>{uploading ? 'Scanning Document...' : 'Upload Ticket / Passport'}</span>
            </button>
          </div>
        </div>

        {/* Quick Prompt Bar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-slate-200 bg-white text-xs">
          {[
            'আপনাদের অফিসের ঠিকানা ও যাওয়ার রাস্তা বলবেন?',
            'ঢাকা থেকে দুবাই টিকিটের দাম কত?',
            'জরুরি টিকিট ডেট চেঞ্জ করতে হবে',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[420px] bg-slate-50/40">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {m.content}
              </div>

              {m.extracted && (
                <div className="mt-2 max-w-[85%] w-full rounded-xl border border-teal-200 bg-teal-50/50 p-3.5 text-xs space-y-2">
                  <div className="font-semibold text-teal-950">
                    Extracted Document Summary
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-500 block">Passenger</span>
                      <span className="font-medium">{m.extracted.passengerName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PNR / Ref</span>
                      <span className="font-mono font-medium">
                        {m.extracted.referenceNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Route</span>
                      <span className="font-medium">{m.extracted.route || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Date</span>
                      <span className="font-medium">{m.extracted.travelDate || '—'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onLoadExtractedToDispatcher(m.extracted!, selectedContact?.phone)
                    }
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    <span>Load into Cascade Dispatcher</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {(sending || uploading) && (
            <div className="text-xs text-slate-500">Toya Air Desk is replying...</div>
          )}
        </div>

        {error && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-slate-200 bg-white flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="বাংলা বা ইংরেজিতে বার্তা লিখুন (যেমন: অফিসের ঠিকানা বা রি-ইস্যু সহায়তা)..."
            className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
