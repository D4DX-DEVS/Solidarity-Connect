import { getObject, storageKeyOf, spacesPublicBases } from './storage.js';

export { spacesPublicBases };

/** Bucket key behind a URL we handed out, or null for anything else (avatars are member-editable). */
export const spacesKeyOf = (url) => storageKeyOf(url);

const NO_PHOTO = { success: false, message: 'No profile photo' };

/**
 * Sends the image behind one of our bucket URLs (a profile photo), or a 404 when the
 * URL is not ours, the object is missing or it is not an image. Reads the bucket
 * directly — the URL itself is never fetched. Other failures throw.
 */
export async function sendBucketImage(res, url) {
  const key = spacesKeyOf(url);
  if (!key) return res.status(404).json(NO_PHOTO);
  const object = await getObject(key);
  if (!object || !object.contentType.startsWith('image/')) return res.status(404).json(NO_PHOTO);
  res.set({ 'Content-Type': object.contentType, 'Cache-Control': 'private, max-age=300' });
  return res.send(Buffer.from(object.bytes));
}
