import { useMemo } from 'react';

type Props = {
  value: string;
  className?: string;
  title?: string;
};

const VERSION = 2;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 34;
const ECC_CODEWORDS = 10;

function gfMultiply(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]) {
  const result = Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
  }
  return result;
}

function appendBits(target: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) target.push((value >>> i) & 1);
}

function makeCodewords(value: string) {
  const bytes = [...new TextEncoder().encode(value)];
  if (bytes.length > 32) throw new Error('Valoarea QR este prea lungă.');

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacity = DATA_CODEWORDS * 8;
  for (let i = 0; i < Math.min(4, capacity - bits.length); i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad++) data.push(pad % 2 === 0 ? 0xec : 0x11);

  return [...data, ...rsRemainder(data, rsDivisor(ECC_CODEWORDS))];
}

function formatBits() {
  const data = 1 << 3; // Error correction level L, mask 0
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function makeMatrix(value: string) {
  const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const isFunction = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };

  const alignment = (cx: number, cy: number) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };

  finder(3, 3);
  finder(SIZE - 4, 3);
  finder(3, SIZE - 4);

  for (let i = 0; i < SIZE; i++) {
    if (!isFunction[6][i]) setFunction(i, 6, i % 2 === 0);
    if (!isFunction[i][6]) setFunction(6, i, i % 2 === 0);
  }
  alignment(18, 18);

  // Reserve format information areas.
  for (let i = 0; i <= 5; i++) setFunction(8, i, false);
  setFunction(8, 7, false);
  setFunction(8, 8, false);
  setFunction(7, 8, false);
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, false);
  for (let i = 0; i < 8; i++) setFunction(SIZE - 1 - i, 8, false);
  for (let i = 8; i < 15; i++) setFunction(8, SIZE - 15 + i, false);
  setFunction(8, SIZE - 8, true);

  const codewords = makeCodewords(value);
  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < SIZE; vert++) {
      const y = upward ? SIZE - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (isFunction[y][x]) continue;
        let bit = false;
        if (bitIndex < codewords.length * 8) {
          bit = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex++;
        }
        if ((x + y) % 2 === 0) bit = !bit; // Mask 0
        modules[y][x] = bit;
      }
    }
    upward = !upward;
  }

  const format = formatBits();
  const getFormatBit = (i: number) => ((format >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) setFunction(8, i, getFormatBit(i));
  setFunction(8, 7, getFormatBit(6));
  setFunction(8, 8, getFormatBit(7));
  setFunction(7, 8, getFormatBit(8));
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, getFormatBit(i));
  for (let i = 0; i < 8; i++) setFunction(SIZE - 1 - i, 8, getFormatBit(i));
  for (let i = 8; i < 15; i++) setFunction(8, SIZE - 15 + i, getFormatBit(i));
  setFunction(8, SIZE - 8, true);

  return modules;
}

export default function SimpleQrCode({ value, className = '', title = 'QR' }: Props) {
  const matrix = useMemo(() => makeMatrix(value), [value]);
  const quiet = 4;
  const full = SIZE + quiet * 2;

  return (
    <svg className={className} viewBox={`0 0 ${full} ${full}`} role="img" aria-label={title} shapeRendering="crispEdges">
      <rect width={full} height={full} fill="white" />
      {matrix.flatMap((row, y) => row.map((dark, x) => dark
        ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width="1" height="1" fill="#111" />
        : null))}
    </svg>
  );
}
