import 'dotenv/config';
import mongoose from 'mongoose';
import Member from '../models/Member.js';
import MemberAuth from '../models/MemberAuth.js';
import District from '../models/District.js';
import Group from '../models/Group.js';
import User from '../models/User.js';

// Seed a member login for a phone number: ensures an Active+approved Member
// and a MemberAuth record so OTP login works.
// Usage: node src/utils/seedMemberLogin.js 9995707129 ["Member Name"]
const rawPhone = process.argv[2] || '9995707129';
const name = process.argv[3] || `Member ${rawPhone}`;
const phone = rawPhone.startsWith('+91') ? rawPhone : `+91${rawPhone}`;
const phoneBare = phone.slice(3);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  let member = await Member.findOne({ phone: { $in: [phone, phoneBare] } });

  if (member) {
    member.status = 'Active';
    member.isApproved = true;
    await member.save();
    console.log(`✅ Existing member "${member.name}" (${member.phone}) set Active + approved`);
  } else {
    const district = await District.findOne().sort({ name: 1 });
    if (!district) throw new Error('No district found — create master data first');
    const group =
      (await Group.findOne({ district: district._id }).sort({ name: 1 })) ||
      (await Group.findOne().sort({ name: 1 }));
    if (!group) throw new Error('No group found — create master data first');
    const admin =
      (await User.findOne({ role: 'state_admin' })) || (await User.findOne());
    if (!admin) throw new Error('No admin user found for createdBy');

    member = await Member.create({
      createdBy: admin._id,
      name,
      phone,
      district: district._id,
      group: group._id,
      status: 'Active',
      isApproved: true,
    });
    console.log(`✅ Created member "${name}" (${phone}) in ${district.name} / ${group.name}`);
  }

  const auth = await MemberAuth.findOneAndUpdate(
    { member: member._id },
    { $set: { phone: member.phone, isActive: true, loginAttempts: 0 }, $unset: { lockUntil: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✅ MemberAuth ready (active: ${auth.isActive}) — login via OTP on ${member.phone}`);

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('❌ Seed failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
