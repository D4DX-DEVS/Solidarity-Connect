import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const User = mongoose.connection.collection('users');

// State admins that are NOT from state.json (extra ones)
console.log('=== STATE ADMINS NOT IN state.json (29 leaders) ===');
const stateAdmins = await User.find({ role: 'state_admin' }, { projection: { name: 1, phone: 1, createdAt: 1 } }).toArray();
const stateJsonPhones = [
  '9947030283','9947497805','9995867499','9633629211','9544321355',
  '8089364163','7306160766','7907185614','9037296439','9072287516',
  '9746349379','9496336486','8089498546','9400123932','9526019540',
  '8590672787','9633631254','9895706961','9895541334','8075943463',
  '9809112493','9495105608','9847928983','9895550436','9544277186',
  '8547061525','9526489584','9656550933','9895283473'
];
const extraState = stateAdmins.filter(u => !stateJsonPhones.includes(u.phone));
console.log(`Total state_admin: ${stateAdmins.length}, Expected: 29, Extra: ${extraState.length}`);
extraState.forEach(u => console.log(`  EXTRA: ${u.name} - ${u.phone} (created: ${u.createdAt})`));

// District admin breakdown
console.log('\n=== DISTRICT ADMIN BREAKDOWN ===');
const districtAdmins = await User.find({ role: 'district_admin' }, { projection: { name: 1, phone: 1, district: 1, createdAt: 1 } }).toArray();
console.log(`Total district_admin: ${districtAdmins.length}`);

// Find test/dummy accounts (98765xxxxx pattern)
const testAccounts = districtAdmins.filter(u => u.phone && u.phone.startsWith('987654'));
console.log(`\nTest accounts (9876543xxx): ${testAccounts.length}`);
testAccounts.forEach(u => console.log(`  TEST: ${u.name} - ${u.phone}`));

// Find people who are BOTH state_admin AND district_admin (same phone)
const statePhones = stateAdmins.map(u => u.phone);
const bothRoles = districtAdmins.filter(u => statePhones.includes(u.phone));
console.log(`\nPeople who are BOTH state_admin + district_admin: ${bothRoles.length}`);
bothRoles.forEach(u => console.log(`  BOTH: ${u.name} - ${u.phone}`));

// People who are BOTH district_admin AND group_admin
const groupAdmins = await User.find({ role: 'group_admin' }, { projection: { name: 1, phone: 1 } }).toArray();
const groupPhones = groupAdmins.map(u => u.phone);
const districtAndGroup = districtAdmins.filter(u => groupPhones.includes(u.phone));
console.log(`\nPeople who are BOTH district_admin + group_admin: ${districtAndGroup.length}`);
districtAndGroup.forEach(u => console.log(`  OVERLAP: ${u.name} - ${u.phone}`));

// People who are BOTH state_admin AND group_admin
const stateAndGroup = stateAdmins.filter(u => groupPhones.includes(u.phone));
console.log(`\nPeople who are BOTH state_admin + group_admin: ${stateAndGroup.length}`);
stateAndGroup.forEach(u => console.log(`  OVERLAP: ${u.name} - ${u.phone}`));

// Total UNIQUE people (by phone)
const allUsers = await User.find({}, { projection: { phone: 1 } }).toArray();
const uniquePhones = new Set(allUsers.map(u => u.phone));
console.log(`\n=== SUMMARY ===`);
console.log(`Total User records: ${allUsers.length}`);
console.log(`Unique phone numbers: ${uniquePhones.size}`);
console.log(`Duplicate records (same person, multiple roles): ${allUsers.length - uniquePhones.size}`);

await mongoose.disconnect();
