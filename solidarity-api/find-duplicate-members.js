// Report-only: find Member docs sharing the same normalized phone number
// (catches "+919876543210" vs "9876543210" duplicates). Deletes nothing.
// Run: node find-duplicate-members.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const Member = mongoose.connection.collection('members');

const normalize = (raw) => {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

const all = await Member.find({}, { projection: { name: 1, phone: 1, status: 1, createdAt: 1 } }).toArray();

const byPhone = new Map();
for (const m of all) {
  const key = normalize(m.phone);
  if (!key) continue;
  if (!byPhone.has(key)) byPhone.set(key, []);
  byPhone.get(key).push(m);
}

const duplicates = [...byPhone.entries()].filter(([, docs]) => docs.length > 1);

console.log('=== DUPLICATE MEMBERS BY NORMALIZED PHONE ===');
console.log(`Total members scanned: ${all.length}`);
console.log(`Duplicate phone numbers found: ${duplicates.length}\n`);

for (const [phone, docs] of duplicates) {
  console.log(`Phone ${phone} — ${docs.length} records:`);
  for (const d of docs) {
    const created = d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : 'n/a';
    console.log(`  - ${d.name} | stored as: ${d.phone} | status: ${d.status} | created: ${created} | id: ${d._id}`);
  }
  console.log('');
}

if (duplicates.length === 0) console.log('No duplicates. Clean.');

await mongoose.disconnect();
