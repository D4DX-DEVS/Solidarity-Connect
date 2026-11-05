// File storage: Cloudflare R2 (Worker binding FILES) when running on Workers,
// DigitalOcean Spaces (S3 API) when running on Node.
const CDN_PREFIX = '/cdn/';

const r2 = () => globalThis.__CF_ENV?.FILES || null;

const s3 = async () => {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET },
    forcePathStyle: false,
  });
  return { client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
};

/** Public URL prefixes of the legacy Spaces bucket: CDN first, then the origin. */
export const spacesPublicBases = () => {
  if (!process.env.DO_SPACES_BUCKET || !process.env.DO_SPACES_ENDPOINT) return [];
  const origin = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT.replace('https://', '')}`;
  const cdn = process.env.DO_SPACES_CDN_ENDPOINT?.replace(/\/$/, '');
  return cdn ? [cdn, origin] : [origin];
};

/** URL we hand out for a stored object. On Workers it is same-origin: /cdn/<key>. */
export const publicUrlFor = (key) => (r2() ? `${CDN_PREFIX}${key}` : `${spacesPublicBases()[0]}/${key}`);

const cleanKey = (key) => (key && !key.includes('..') && !key.startsWith('/') ? key : null);

/**
 * Bucket key behind a URL we handed out (/cdn/<key>, https://<any host>/cdn/<key>, or a
 * legacy Spaces URL), or null for anything else. The URL itself is never fetched.
 */
export const storageKeyOf = (url) => {
  if (typeof url !== 'string' || !url) return null;
  const strip = (s) => decodeURIComponent(s.split(/[?#]/)[0]);
  if (url.startsWith(CDN_PREFIX)) return cleanKey(strip(url.slice(CDN_PREFIX.length)));
  const base = spacesPublicBases().find((b) => url.startsWith(`${b}/`));
  if (base) return cleanKey(strip(url.slice(base.length + 1)));
  const legacy = url.match(/^https:\/\/[a-z0-9-]+\.[a-z0-9]+\.(?:cdn\.)?digitaloceanspaces\.com\/(.+)$/i);
  if (legacy) return cleanKey(strip(legacy[1]));
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && u.pathname.startsWith(CDN_PREFIX)) return cleanKey(decodeURIComponent(u.pathname.slice(CDN_PREFIX.length)));
  } catch {
    /* not a URL */
  }
  return null;
};

export async function putObject(key, body, contentType) {
  const bucket = r2();
  if (bucket) {
    await bucket.put(key, body, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
    return;
  }
  const { client, PutObjectCommand } = await s3();
  await client.send(new PutObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key: key, Body: body, ContentType: contentType, ACL: 'public-read' }));
}

/** Object bytes + content type, or null when missing. */
export async function getObject(key) {
  const bucket = r2();
  if (bucket) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return { contentType: obj.httpMetadata?.contentType || 'application/octet-stream', bytes: new Uint8Array(await obj.arrayBuffer()) };
  }
  const { client, GetObjectCommand } = await s3();
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key: key }));
    return { contentType: obj.ContentType || 'application/octet-stream', bytes: await obj.Body.transformToByteArray() };
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export async function deleteObject(key) {
  const bucket = r2();
  if (bucket) {
    await bucket.delete(key);
    return;
  }
  const { client, DeleteObjectCommand } = await s3();
  await client.send(new DeleteObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET, Key: key }));
}
