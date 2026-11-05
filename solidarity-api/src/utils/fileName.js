/**
 * Browsers send multipart filenames as raw UTF-8 bytes, but busboy (under multer 1.x)
 * decodes them as Latin-1, so "മലയാളം.pdf" arrives as "à´®à´²...". This re-reads such a
 * name as UTF-8. Names that are plain ASCII, already contain real Unicode, or whose bytes
 * are not valid UTF-8 come back unchanged, so applying it twice is safe.
 * @param {string} name
 * @returns {string}
 */
export function decodeUploadName(name) {
  if (typeof name !== 'string' || /[^\x00-\xff]/.test(name) || !/[\x80-\xff]/.test(name)) return name;
  const bytes = Buffer.from(name, 'latin1');
  const decoded = bytes.toString('utf8');
  // A lossless round trip means the bytes really were UTF-8.
  return Buffer.from(decoded, 'utf8').equals(bytes) ? decoded : name;
}
