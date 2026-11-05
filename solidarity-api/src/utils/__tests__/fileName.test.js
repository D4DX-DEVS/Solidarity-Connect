import { decodeUploadName } from '../fileName.js';

// What busboy hands multer when a browser uploads "<name>": the UTF-8 bytes read as Latin-1.
const asBusboyReadsIt = (name) => Buffer.from(name, 'utf8').toString('latin1');

describe('decodeUploadName', () => {
  test('restores Malayalam names that arrived as Latin-1 mojibake', () => {
    const name = 'മെമ്പേഴ്സ് ഗ്രൂപ്പ് 2026 മാർച്ച് .pdf';
    expect(asBusboyReadsIt(name)).not.toBe(name);
    expect(decodeUploadName(asBusboyReadsIt(name))).toBe(name);
  });

  test('restores accented Latin names too', () => {
    expect(decodeUploadName(asBusboyReadsIt('café résumé.docx'))).toBe('café résumé.docx');
  });

  test('leaves ASCII names unchanged', () => {
    expect(decodeUploadName('Circular April - June.pdf')).toBe('Circular April - June.pdf');
  });

  test('leaves names that are already proper Unicode unchanged (safe to apply twice)', () => {
    const name = 'സോളിഡാരിറ്റി അംഗത്വാപേക്ഷ (2).docx';
    expect(decodeUploadName(name)).toBe(name);
    expect(decodeUploadName(decodeUploadName(asBusboyReadsIt(name)))).toBe(name);
  });

  test('leaves genuine Latin-1 names whose bytes are not valid UTF-8 unchanged', () => {
    expect(decodeUploadName('café.pdf')).toBe('café.pdf');
  });

  test('passes through empty and non-string values', () => {
    expect(decodeUploadName('')).toBe('');
    expect(decodeUploadName(undefined)).toBe(undefined);
  });
});
