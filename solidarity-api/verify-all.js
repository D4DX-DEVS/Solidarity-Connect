import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const User = mongoose.connection.collection('users');
const Member = mongoose.connection.collection('members');
const District = mongoose.connection.collection('districts');
const Group = mongoose.connection.collection('groups');

console.log('════════════════════════════════════════════════════════');
console.log('  FULL SYSTEM VERIFICATION');
console.log('════════════════════════════════════════════════════════\n');

// ─── Users Collection ────────────────────────────────────────────────────────
const totalUsers = await User.countDocuments({});
const activeUsers = await User.countDocuments({ isActive: true });
const stateAdmins = await User.find({ role: 'state_admin' }).toArray();
const districtAdmins = await User.find({ role: 'district_admin' }).toArray();
const groupAdmins = await User.countDocuments({ role: 'group_admin' });

console.log('═══ USERS COLLECTION ═══════════════════════════════════\n');
console.log(`  Total Users: ${totalUsers}`);
console.log(`  Active: ${activeUsers}`);
console.log(`  State Admins: ${stateAdmins.length}`);
console.log(`  District Admins: ${districtAdmins.length}`);
console.log(`  Group Admins: ${groupAdmins}`);
console.log(`  Sum check: ${stateAdmins.length + districtAdmins.length + groupAdmins} (should = ${totalUsers})`);

// ─── State Admins Detail ─────────────────────────────────────────────────────
console.log('\n  STATE ADMINS:');
for (const u of stateAdmins) {
  console.log(`    • ${u.name} — ${u.phone} (active: ${u.isActive})`);
}

// ─── District Admins Detail ──────────────────────────────────────────────────
const allDistricts = await District.find({}).toArray();
const distMap = {};
for (const d of allDistricts) distMap[d._id.toString()] = d.name;

console.log('\n  DISTRICT ADMINS:');
for (const u of districtAdmins) {
  const distName = u.district ? (distMap[u.district.toString()] || 'UNKNOWN') : 'NO DISTRICT';
  console.log(`    • ${u.name} — ${u.phone} — ${distName} (active: ${u.isActive})`);
}

// ─── Members Collection ──────────────────────────────────────────────────────
console.log('\n═══ MEMBERS COLLECTION ═════════════════════════════════\n');
const totalMembers = await Member.countDocuments({});
const activeMembers = await Member.countDocuments({ status: 'active' });
const inactiveMembers = await Member.countDocuments({ status: { $ne: 'active' } });
const approvedMembers = await Member.countDocuments({ isApproved: true });

console.log(`  Total Members: ${totalMembers}`);
console.log(`  Active: ${activeMembers}`);
console.log(`  Not Active: ${inactiveMembers}`);
console.log(`  Approved: ${approvedMembers}`);

// ─── Districts & Groups ──────────────────────────────────────────────────────
console.log('\n═══ DISTRICTS & GROUPS ═════════════════════════════════\n');
const totalDistricts = await District.countDocuments({});
const totalGroups = await Group.countDocuments({});
console.log(`  Districts: ${totalDistricts}`);
console.log(`  Groups: ${totalGroups}`);

// Members per district
const membersByDistrict = await Member.aggregate([
  { $group: { _id: '$district', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();
console.log('\n  Members per District:');
for (const d of membersByDistrict) {
  const name = d._id ? (distMap[d._id.toString()] || 'UNKNOWN') : 'NO DISTRICT';
  console.log(`    ${name}: ${d.count}`);
}

// ─── Duplicate Check ─────────────────────────────────────────────────────────
console.log('\n═══ INTEGRITY CHECKS ═══════════════════════════════════\n');

// Duplicate users (same phone + role)
const dupUsers = await User.aggregate([
  { $group: { _id: { phone: '$phone', role: '$role' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();
console.log(`  Duplicate User records (same phone+role): ${dupUsers.length === 0 ? '✅ None' : '❌ ' + dupUsers.length}`);

// Same phone multiple roles
const multiRole = await User.aggregate([
  { $group: { _id: '$phone', roles: { $addToSet: '$role' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();
console.log(`  Same phone, multiple user records: ${multiRole.length === 0 ? '✅ None' : '⚠️  ' + multiRole.length}`);
if (multiRole.length > 0) {
  for (const m of multiRole) {
    console.log(`    • ${m._id} → ${m.roles.join(', ')}`);
  }
}

// Test accounts check
const testAccounts = await User.countDocuments({ phone: { $regex: /^987654/ } });
console.log(`  Test accounts (9876543xxx): ${testAccounts <= 1 ? '✅ Only master (9876543210)' : '⚠️  ' + testAccounts + ' found'}`);

// Leaders check
const stateLeaders = await User.countDocuments({ isLeader: true, 'roleTag.type': 'state' });
const districtLeaders = await User.countDocuments({ isLeader: true, 'roleTag.type': 'district' });
const memberStateLeaders = await Member.countDocuments({ isLeader: true, 'roleTag.type': 'state' });
const memberDistrictLeaders = await Member.countDocuments({ isLeader: true, 'roleTag.type': 'district' });
console.log(`\n  Leaders (User collection): state=${stateLeaders}, district=${districtLeaders}`);
console.log(`  Leaders (Member collection): state=${memberStateLeaders}, district=${memberDistrictLeaders}`);

console.log('\n════════════════════════════════════════════════════════');
console.log('  VERIFICATION COMPLETE');
console.log('════════════════════════════════════════════════════════\n');

await mongoose.disconnect();
