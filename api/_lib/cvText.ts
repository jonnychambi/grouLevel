/** Extracción de texto de CVs (PDF, DOCX, TXT) en el servidor, sin dependencias pesadas. */
import { inflateRawSync } from 'node:zlib';

export const CV_TYPES: Record<string, 'pdf' | 'docx' | 'txt'> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt'
};

/** Determina el tipo por contenido (firma) y no solo por la extensión/MIME que envía el navegador. */
export function detectCvType(bytes: Uint8Array, name: string): 'pdf' | 'docx' | 'txt' | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'; // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && /\.docx$/i.test(name)) return 'docx'; // PK (zip)
  if (/\.txt$/i.test(name) && !bytes.subarray(0, 2048).includes(0)) return 'txt';
  return null;
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

/** Lee word/document.xml del zip (directorio central) y lo convierte a texto plano por párrafos. */
export function docxText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('docx_invalido');
  const entries = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  for (let e = 0; e < entries; e++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    if (name === 'word/document.xml') {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      const xml = (method === 8 ? inflateRawSync(data, { maxOutputLength: 20 * 1024 * 1024 }) : data).toString('utf8');
      return xml
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('docx_sin_documento');
}

export async function extractCvText(bytes: Uint8Array, type: 'pdf' | 'docx' | 'txt'): Promise<string> {
  if (type === 'pdf') return pdfText(bytes);
  if (type === 'docx') return docxText(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}
