// Runs the Express API on the D1 shim over a local SQLite file (no Workers runtime).
//   node --import ./worker/dev/register.mjs worker/dev/node-server.mjs <sqliteFile> [port]
import 'dotenv/config';
import mongoose from 'mongoose';
import { createD1 } from './sqlite-d1.mjs';

const [file, port = '5004'] = process.argv.slice(2);
if (!file) {
  console.error('usage: node-server.mjs <sqliteFile> [port]');
  process.exit(1);
}
mongoose.setDatabase(createD1(file));
const { createApp } = await import('../../src/app.js');
createApp().listen(Number(port), () => console.log(`D1-shim API on http://localhost:${port}`));
