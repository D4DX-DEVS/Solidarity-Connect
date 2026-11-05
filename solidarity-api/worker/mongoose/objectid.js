// Minimal BSON-compatible ObjectId: 24-char hex, generated the same way as the driver
// (4-byte timestamp + 5-byte process id + 3-byte counter).
const HEX24 = /^[0-9a-fA-F]{24}$/;

export class BSONError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BSONError';
  }
}

const hexOfBytes = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
// Seeded on first use: Workers forbid random values in global scope.
let PROCESS_UNIQUE = null;
let counter = 0;

const generate = (seconds = Math.floor(Date.now() / 1000)) => {
  if (PROCESS_UNIQUE === null) {
    PROCESS_UNIQUE = hexOfBytes(crypto.getRandomValues(new Uint8Array(5)));
    counter = crypto.getRandomValues(new Uint32Array(1))[0] & 0xffffff;
  }
  counter = (counter + 1) & 0xffffff;
  return (seconds >>> 0).toString(16).padStart(8, '0') + PROCESS_UNIQUE + counter.toString(16).padStart(6, '0');
};

export class ObjectId {
  constructor(input) {
    let hex;
    if (input === undefined || input === null) hex = generate();
    else if (input instanceof ObjectId) hex = input.__hex;
    else if (typeof input === 'string' && HEX24.test(input)) hex = input.toLowerCase();
    else if (typeof input === 'number' && Number.isInteger(input)) hex = generate(input);
    else if (typeof input === 'string' && input.length === 12 && [...input].every((c) => c.charCodeAt(0) < 256)) {
      hex = hexOfBytes([...input].map((c) => c.charCodeAt(0)));
    } else if (input instanceof Uint8Array && input.length === 12) hex = hexOfBytes(input);
    else if (typeof input === 'object' && typeof input.toHexString === 'function') hex = String(input.toHexString()).toLowerCase();
    else throw new BSONError('input must be a 24 character hex string, 12 byte Uint8Array, or an integer');
    Object.defineProperty(this, '__hex', { value: hex, enumerable: false });
  }

  get _bsontype() {
    return 'ObjectId';
  }

  get id() {
    return this.__hex;
  }

  toHexString() {
    return this.__hex;
  }

  toString() {
    return this.__hex;
  }

  toJSON() {
    return this.__hex;
  }

  equals(other) {
    if (other === null || other === undefined) return false;
    const hex = idString(other);
    return typeof hex === 'string' && hex.toLowerCase() === this.__hex;
  }

  getTimestamp() {
    return new Date(parseInt(this.__hex.slice(0, 8), 16) * 1000);
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `new ObjectId("${this.__hex}")`;
  }

  static isValid(value) {
    if (value === null || value === undefined) return false;
    try {
      new ObjectId(value);
      return true;
    } catch {
      return false;
    }
  }

  static createFromHexString(hex) {
    if (!HEX24.test(hex)) throw new BSONError('input must be a 24 character hex string');
    return new ObjectId(hex);
  }

  static createFromTime(seconds) {
    return new ObjectId(seconds.toString(16).padStart(8, '0') + '0000000000000000');
  }

  static generate(seconds) {
    return generate(seconds);
  }
}

export const isHex24 = (value) => typeof value === 'string' && HEX24.test(value);

/**
 * Hex string behind any id-like value (ObjectId, hex string, document or `{ _id }`),
 * or the value itself when it is not id-like.
 */
export function idString(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof ObjectId) return value.__hex;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString());
    if ('_id' in value && value._id !== value) return idString(value._id);
  }
  return value;
}
