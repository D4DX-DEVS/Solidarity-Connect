// One-off: dump every MongoDB collection to EJSON files for D1 migration.
import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { EJSON } from 'bson';

const outDir = path.join('backups', `d1-export-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outDir, { recursive: true });
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const cols = await db.listCollections().toArray();
const summary = {};
for (const c of cols) {
  const docs = await db.collection(c.name).find({}).toArray();
  fs.writeFileSync(path.join(outDir, `${c.name}.json`), EJSON.stringify(docs, { relaxed: false }));
  summary[c.name] = docs.length;
}
fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify(summary, null, 2));
console.log(outDir);
console.log(summary);
await mongoose.disconnect();
