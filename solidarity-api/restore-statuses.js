/**
 * Re-apply member status (and member-auth isActive) from the people Excel.
 * Needed once after migrate-people.js: the old server.js startup step had
 * force-activated every Inactive member on restart.
 *
 * Usage: node restore-statuses.js [--execute] [--file <path.xlsx>]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import { DEFAULT_XLSX, readRows, buildPeople } from './people-migration-lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
const EXECUTE = process.argv.includes('--execute');
const fileIdx = process.argv.indexOf('--file');
const XLSX_PATH = fileIdx !== -1 ? process.argv[fileIdx + 1] : DEFAULT_XLSX;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const { people } = buildPeople(readRows(XLSX_PATH), await District.find({}).lean(), await Group.find({}).lean());
  let fixed = 0;
  for (const p of people) {
    const m = await Member.findOne({ phone: p.phone.member });
    if (!m || m.status === p.status) continue;
    console.log(`  ${p.name} ${p.phone.member}: ${m.status} → ${p.status}`);
    fixed++;
    if (!EXECUTE) continue;
    await Member.updateOne({ _id: m._id }, { $set: { status: p.status } });
    await MemberAuth.updateOne({ member: m._id }, { $set: { isActive: p.status === 'Active' } });
  }
  for (const d of await District.find({})) if (EXECUTE) await d.updateStatistics();
  for (const g of await Group.find({})) if (EXECUTE) await g.updateStatistics();
  console.log(`${EXECUTE ? 'Restored' : 'Would restore'} ${fixed} status(es)`);
}

run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
