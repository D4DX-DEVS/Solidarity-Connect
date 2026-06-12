import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);
console.log('📦 Connected to MongoDB');

const User   = mongoose.connection.collection('users');
const Member = mongoose.connection.collection('members');
const District = mongoose.connection.collection('districts');

const NEW_PHONE = '9037434496';

// ── 1. Find the member ────────────────────────────────────────────────────────
const phoneVariants = [NEW_PHONE, `+91${NEW_PHONE}`];
const member = await Member.findOne({ phone: { $in: phoneVariants } });

if (!member) {
  console.error(`❌ No member found with phone ${NEW_PHONE}`);
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`✅ Member found: ${member.name} (${member.phone})`);

// ── 2. Find Kasargod district ─────────────────────────────────────────────────
const district = await District.findOne({ name: /kasargod/i });

if (!district) {
  console.error('❌ Kasargod district not found');
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`✅ District found: ${district.name} (_id: ${district._id})`);

// ── 3. Deactivate the old district admin ─────────────────────────────────────
if (district.admin) {
  const old = await User.findOne({ _id: district.admin });
  if (old) {
    await User.updateOne(
      { _id: old._id },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    console.log(`⚠️  Old admin deactivated: ${old.name} (${old.phone})`);
  }
}

// ── 4. Create or update User record for the new admin ────────────────────────
const existing = await User.findOne({ phone: { $in: phoneVariants } });

let newAdminId;
if (existing) {
  await User.updateOne(
    { _id: existing._id },
    {
      $set: {
        role: 'district_admin',
        district: district._id,
        isActive: true,
        updatedAt: new Date()
      }
    }
  );
  newAdminId = existing._id;
  console.log(`✅ Existing user updated to district_admin: ${existing.name}`);
} else {
  const result = await User.insertOne({
    name: member.name,
    phone: member.phone,
    role: 'district_admin',
    district: district._id,
    isActive: true,
    permissions: [
      'manage_members', 'manage_groups',
      'approve_transfers', 'send_notifications',
      'view_reports', 'manage_meetings', 'manage_baithul_maal'
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  });
  newAdminId = result.insertedId;
  console.log(`✅ New user created as district_admin: ${member.name} (${member.phone})`);
}

// ── 5. Update district's admin pointer ───────────────────────────────────────
await District.updateOne(
  { _id: district._id },
  { $set: { admin: newAdminId, updatedAt: new Date() } }
);
console.log(`✅ Kasargod district admin updated to: ${member.name} (${NEW_PHONE})`);

await mongoose.disconnect();
console.log('✅ Done');
