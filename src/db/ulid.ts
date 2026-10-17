const FALLBACK_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomValues(length: number): number[] {
  const values = new Array<number>(length);
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint8Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) values[i] = buf[i];
  } else {
    for (let i = 0; i < length; i++) values[i] = Math.floor(Math.random() * 256);
  }
  return values;
}

function encodeTime(now: number, length: number): string {
  let time = now;
  let out = '';
  for (let i = 0; i < length; i++) {
    out = FALLBACK_ALPHABET[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

let lastTime = 0;
let lastRandom: number[] = [];

export function createUlid(prefix?: string): string {
  const now = Date.now();
  let random = randomValues(10);
  if (now === lastTime) {
    let increment = true;
    for (let i = random.length - 1; i >= 0; i--) {
      const next = (lastRandom[i] + (increment ? 1 : 0)) & 0xff;
      random[i] = next;
      if (next !== 0) increment = false;
    }
  }
  lastTime = now;
  lastRandom = random;
  const id = encodeTime(now, 10) + random.map((v) => FALLBACK_ALPHABET[v % 32]).join('');
  return prefix ? `${prefix}-${id}` : id;
}

export function cardStem(id: string): string {
  const parts = id.split('-');
  if (parts.length <= 3) return id;
  const head = parts.slice(0, 2).join('-');
  const tail = parts.slice(2).join('');
  return `${head.slice(0, 3)}…${tail.slice(-6)}`;
}
