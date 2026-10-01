import 'dotenv/config';
import mongoose from 'mongoose';
import Member from '../models/Member.js';
import MemberAuth from '../models/MemberAuth.js';
import District from '../models/District.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { TEST_PHONE, phoneVariants } from '../services/loginService.js';

// Restore the shared QA login: State Admin, District Admin, Area Admin AND a
// Member profile on TEST_PHONE, so every dashboard can be checked with a single
// number. Idempotent — re-running updates the same rows instead of duplicating.
// Scope: the explicit args, else the scope the test Area Admin already has, else
// the district with the most members and its biggest area.
// The test member is a real member row, so it adds 1 to that area's counts.
//
// SECURITY: loginService accepts TEST_PHONE with a fixed, publicly known OTP in
// every environment, so these rows are a working State Admin login for anyone
// who knows the number. Never run this against production data.
// Usage: node src/utils/seedTestAccounts.js [districtName] [groupName]
const [districtArg, groupArg] = process.argv.slice(2);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Re-running without args must not silently move the test accounts elsewhere.
const existingAreaAdmin = () =>
  User.findOne({ phone: TEST_PHONE, role: 'group_admin', adminKind: 'area' }).lean();

async function pickDistrict() {
  if (districtArg) {
    const found = await District.findOne({ name: new RegExp(`^${escapeRegex(districtArg)}$`, 'i') });
    if (!found) throw new Error(`District "${districtArg}" not found`);
    return found;
  }
  const current = await existingAreaAdmin();
  const kept = current?.district && (await District.findById(current.district));
  if (kept) return kept;
  const [top] = await Member.aggregate([
    { $group: { _id: '$district', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  const found = top && (await District.findById(top._id));
  if (!found) throw new Error('No district found — create master data first');
  return found;
}

async function pickGroup(district) {
  if (groupArg) {
    const found = await Group.findOne({ district: district._id, name: new RegExp(`^${escapeRegex(groupArg)}$`, 'i') });
    if (!found) throw new Error(`Group "${groupArg}" not found in ${district.name}`);
    return found;
  }
  const current = await existingAreaAdmin();
  const kept = current?.group && (await Group.findOne({ _id: current.group, district: district._id }));
  if (kept) return kept;
  const [top] = await Member.aggregate([
    { $match: { district: district._id } },
    { $group: { _id: '$group', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  const found = (top && (await Group.findById(top._id))) || (await Group.findOne({ district: district._id }));
  if (!found) throw new Error(`No group found in ${district.name}`);
  return found;
}

async function upsertAdmin(role, fields) {
  const filter = { phone: TEST_PHONE, role, adminKind: 'area' };
  let user = await User.findOne(filter);
  if (!user) user = new User({ ...filter });
  Object.assign(user, { isActive: true, isLeader: false, ...fields });
  // Role is unchanged on update, so the permissions pre-save hook would skip — mark it.
  user.markModified('role');
  await user.save();
  return user;
}

// Member login needs: status Active + isApproved (listAccounts / selectAccount)
// and an active MemberAuth row.
async function upsertMember(district, group, approver) {
  let member = await Member.findOne({ phone: { $in: phoneVariants(TEST_PHONE) } });
  if (!member) member = new Member({ phone: `+91${TEST_PHONE}`, createdBy: approver._id });
  Object.assign(member, {
    name: 'Test Member',
    district: district._id,
    group: group._id,
    address: 'Test Unit',
    status: 'Active',
    isApproved: true,
    approvedBy: approver._id,
    approvedAt: member.approvedAt || new Date(),
    isLeader: false,
  });
  await member.save();

  await MemberAuth.findOneAndUpdate(
    { member: member._id },
    { $set: { phone: member.phone, isActive: true }, $unset: { lockUntil: 1 } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return member;
}

const run = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed QA accounts with NODE_ENV=production');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`⚠️  Seeding QA logins into "${mongoose.connection.db.databaseName}" on ${mongoose.connection.host}`);

  const district = await pickDistrict();
  const group = await pickGroup(district);

  const stateAdmin = await upsertAdmin('state_admin', { name: 'Test State Admin' });
  await upsertAdmin('district_admin', { name: 'Test District Admin', district: district._id });
  await upsertAdmin('group_admin', {
    name: 'Test Area Admin',
    district: district._id,
    group: group._id,
    // roleTag.type 'area' + roleDescription = area name is what makes the
    // backend scope this admin to every unit in the area (isAreaLevelAdmin).
    roleTag: { type: 'area', name: 'TEST', roleDescription: group.name },
  });

  await upsertMember(district, group, stateAdmin);

  console.log(`✅ Test accounts ready on ${TEST_PHONE}: State Admin, District Admin (${district.name}), Area Admin (${group.name}), Member (${group.name})`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('❌ Seed failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
