// Lists every object in the DigitalOcean Spaces bucket (credentials from .env, never
// printed) and compares it with what was copied to R2 for this migration.
//   node worker/scripts/list-spaces.mjs <exportDir>   (run from solidarity-api/)
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

dotenv.config();
const [exportDir] = process.argv.slice(2);
const migrated = new Set(JSON.parse(fs.readFileSync(path.join(exportDir, 'r2-objects.json'), 'utf8')).map((o) => o.key));

const endpoint = process.env.DO_SPACES_ENDPOINT;
const client = new S3Client({
  endpoint: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
  region: 'us-east-1',
  credentials: { accessKeyId: process.env.DO_SPACES_KEY, secretAccessKey: process.env.DO_SPACES_SECRET },
});

const objects = [];
let token;
do {
  const page = await client.send(new ListObjectsV2Command({ Bucket: process.env.DO_SPACES_BUCKET, ContinuationToken: token }));
  objects.push(...(page.Contents || []));
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

const byPrefix = {};
for (const o of objects) {
  const prefix = o.Key.includes('/') ? o.Key.slice(0, o.Key.indexOf('/') + 1) : '(root)';
  const p = (byPrefix[prefix] ||= { count: 0, bytes: 0, migrated: 0 });
  p.count++;
  p.bytes += o.Size || 0;
  if (migrated.has(o.Key)) p.migrated++;
}
console.log(`bucket objects: ${objects.length}`);
for (const [prefix, p] of Object.entries(byPrefix)) {
  console.log(`${prefix.padEnd(28)} ${String(p.count).padStart(5)} objects  ${(p.bytes / 1048576).toFixed(1).padStart(8)} MB  migrated ${p.migrated}`);
}
const notInBucket = [...migrated].filter((k) => !objects.some((o) => o.Key === k));
console.log(`referenced by DB but missing from bucket: ${notInBucket.length}`);
const unreferenced = objects.filter((o) => !migrated.has(o.Key) && !o.Key.endsWith('/'));
console.log(`in bucket but not referenced by any record: ${unreferenced.length}`);
for (const o of unreferenced.slice(0, 40)) console.log(`  ${o.Key}  ${o.Size} B  ${o.LastModified?.toISOString?.().slice(0, 10)}`);
