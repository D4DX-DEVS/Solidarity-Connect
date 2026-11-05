// Cloudflare Worker entry: the existing Express API (on the D1-backed mongoose shim)
// behind /api and /health, public files from R2 at /cdn/*, and everything else is the
// Vite SPA from static assets (wrangler.jsonc run_worker_first decides what reaches us).
import { env } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';
import { createApp } from '../src/app.js';

// Bindings (DB = D1, FILES = R2) are read lazily by the data/storage layers.
globalThis.__CF_ENV = env;

const PORT = 3000;
const app = createApp({ worker: true });
app.listen(PORT);

const notFound = () =>
  Response.json({ success: false, message: 'Not found' }, { status: 404 });

/**
 * Streams an R2 object without buffering it (org files reach ~40 MB), with Range
 * support for PDF viewers and ETag revalidation. Keys are random and never reused,
 * so browsers may cache them for a year.
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function serveFile(request, url) {
  let key;
  try {
    key = decodeURIComponent(url.pathname.slice('/cdn/'.length));
  } catch {
    return notFound();
  }
  if (!key || key.includes('..')) return notFound();

  const isHead = request.method === 'HEAD';
  const hasRange = !isHead && request.headers.has('Range');
  let object;
  try {
    object = isHead
      ? await env.FILES.head(key)
      : await env.FILES.get(key, { range: hasRange ? request.headers : undefined, onlyIf: request.headers });
  } catch (error) {
    if (hasRange) return new Response(null, { status: 416 });
    throw error;
  }
  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');

  if (isHead) {
    headers.set('Content-Length', String(object.size));
    return new Response(null, { headers });
  }
  // onlyIf precondition (If-None-Match) matched: R2 returns metadata without a body.
  if (!('body' in object)) return new Response(null, { status: 304, headers });

  if (hasRange && object.range) {
    const { size } = object;
    const offset = object.range.offset ?? size - object.range.suffix;
    const length = object.range.length ?? size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}

export default {
  /** @param {Request} request */
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/cdn/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return serveFile(request, url);
    }
    return handleAsNodeRequest(PORT, request);
  },
};
