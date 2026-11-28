import {safeBankURL} from './bank.mjs';
import {sha256} from '../data/common.js';

// Each generated module contains one JSON value after "export default".
// Reading the literal lets a session verify the exact bytes before consuming them.
const decoded = new Map();
export async function readVerifiedPackage(entry, signal, installedBytes) {
  const url = safeBankURL(entry.url);
  if (!url.pathname.endsWith('.mjs') || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1) {
    throw new Error('INVALID_PACKAGE');
  }
  signal?.throwIfAborted();
  const key = url.href + '#' + entry.sha256;
  if (decoded.has(key)) return decoded.get(key);
  let bytes = installedBytes;
  if (!bytes) {
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error('BANK_LOAD');
    bytes = await response.arrayBuffer();
  }
  if (bytes.byteLength !== entry.bytes || await sha256(bytes) !== entry.sha256) throw new Error('CHECKSUM_MISMATCH');
  const source = new TextDecoder('utf-8', {fatal:true}).decode(bytes).trimEnd();
  const prefix = 'export default ';
  if (!source.startsWith(prefix) || !source.endsWith(';')) throw new Error('INVALID_PACKAGE');
  const pkg = JSON.parse(source.slice(prefix.length, -1));
  if (pkg.package_id !== entry.package_id || pkg.content_version !== entry.content_version ||
      !Array.isArray(pkg.questions) || pkg.questions.length !== entry.question_count) {
    throw new Error('INVALID_PACKAGE');
  }
  signal?.throwIfAborted();
  if (decoded.size === 3) decoded.delete(decoded.keys().next().value);
  decoded.set(key, pkg);
  return pkg;
}
