import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

/** DigitalOcean Spaces (S3 API) client for our bucket. */
export const spacesClient = () => new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET
  },
  forcePathStyle: false
});

/** Public URL prefixes of our bucket: the CDN first (what uploads hand out), then the origin. */
export const spacesPublicBases = () => {
  const origin = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT?.replace('https://', '')}`;
  const cdn = process.env.DO_SPACES_CDN_ENDPOINT?.replace(/\/$/, '');
  return cdn ? [cdn, origin] : [origin];
};

/** Bucket key behind a URL we handed out, or null for anything else (avatars are member-editable). */
export const spacesKeyOf = (url) => {
  if (typeof url !== 'string') return null;
  const base = spacesPublicBases().find((b) => url.startsWith(`${b}/`));
  const key = base ? decodeURIComponent(url.slice(base.length + 1).split(/[?#]/)[0]) : '';
  return key && !key.includes('..') ? key : null;
};

const NO_PHOTO = { success: false, message: 'No profile photo' };

/**
 * Sends the image behind one of our bucket URLs (a profile photo), or a 404 when the
 * URL is not ours, the object is missing or it is not an image. Reads the bucket
 * directly — the URL itself is never fetched. Other failures throw.
 */
export async function sendBucketImage(res, url) {
  const key = spacesKeyOf(url);
  if (!key) return res.status(404).json(NO_PHOTO);
  try {
    const object = await spacesClient().send(new GetObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key: key }));
    if (!object.ContentType?.startsWith('image/')) return res.status(404).json(NO_PHOTO);
    res.set({ 'Content-Type': object.ContentType, 'Cache-Control': 'private, max-age=300' });
    return res.send(Buffer.from(await object.Body.transformToByteArray()));
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return res.status(404).json(NO_PHOTO);
    throw error;
  }
}
