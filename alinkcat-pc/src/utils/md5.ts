/** 纯 TypeScript MD5 实现（无外部依赖） */
export function md5(str: string): string {
  const utf8 = encodeUtf8(str);
  const words = bytesToWords(utf8);
  const hash = coreMd5(words);
  return wordToHex(hash);
}

function encodeUtf8(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0xd800 || c >= 0xe000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else { i++; const c2 = s.charCodeAt(i); bytes.push(0xf0 | ((c & 0x3ff) >> 4) | 0x08, 0x80 | ((c & 0x3ff) >> 6), 0x80 | ((c2 & 0x3f)), 0x80 | (c2 & 0x3f)); }
  }
  return bytes;
}

function bytesToWords(bytes: number[]): number[] {
  const len = bytes.length;
  const words: number[] = [];
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  words[(((len + 8) >> 6) << 4) + 14] = len * 8;
  return words;
}

function coreMd5(words: number[]): number[] {
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const T = new Array(64);
  for (let i = 0; i < 64; i++) T[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let i = 0; i < words.length; i += 16) {
    const X = words.slice(i, i + 16);
    let A = a, B = b, C = c, D = d;
    for (let j = 0; j < 64; j++) {
      let F, g;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      const temp = D;
      D = C;
      C = B;
      B = (B + ((A + F + T[j] + (X[g] || 0)) << s[j] | (A + F + T[j] + (X[g] || 0)) >>> (32 - s[j]))) >>> 0;
      A = temp;
    }
    a = (a + A) >>> 0;
    b = (b + B) >>> 0;
    c = (c + C) >>> 0;
    d = (d + D) >>> 0;
  }
  return [a, b, c, d];
}

function wordToHex(words: number[]): string {
  let hex = '';
  for (const w of words) {
    for (let i = 0; i < 4; i++) hex += ((w >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
  }
  return hex;
}

/** 生成当前分钟的开发者密码 */
export function getDeveloperPassword(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return md5(`${y}-${m}-${d}-${h}-${min}`);
}