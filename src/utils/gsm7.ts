// Standard GSM-7 basic character set + extension characters
const GSM7_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);
const GSM7_EXTENDED = new Set('^{}\\[~]|€');

export interface SmsEncodingReport {
  encoding: 'GSM-7' | 'UCS-2';
  charCount: number;
  septetCount: number;
  singleLimit: number;
  concatLimit: number;
  segments: number;
  nonGsmChars: string[];
}

export function analyzeSmsEncoding(text: string): SmsEncodingReport {
  let septetCount = 0;
  const nonGsmSet = new Set<string>();

  for (const ch of text) {
    if (GSM7_BASIC.has(ch)) {
      septetCount += 1;
    } else if (GSM7_EXTENDED.has(ch)) {
      septetCount += 2;
    } else {
      nonGsmSet.add(ch);
    }
  }

  const nonGsmChars = Array.from(nonGsmSet);
  const isGsm7 = nonGsmChars.length === 0;
  const charCount = isGsm7 ? septetCount : Array.from(text).length;
  const singleLimit = isGsm7 ? 160 : 70;
  const concatLimit = isGsm7 ? 153 : 67;
  const segments =
    charCount === 0
      ? 1
      : charCount <= singleLimit
        ? 1
        : Math.ceil(charCount / concatLimit);

  return {
    encoding: isGsm7 ? 'GSM-7' : 'UCS-2',
    charCount,
    septetCount,
    singleLimit,
    concatLimit,
    segments,
    nonGsmChars,
  };
}
