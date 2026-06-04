import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const User = mongoose.connection.collection('users');

const total = await User.countDocuments({});
const active = await User.countDocuments({ isActive: true });
const inactive = await User.countDocuments({ isActive: { $ne: true } });
const stateAdmins = await User.countDocuments({ role: 'state_admin' });
const districtAdmins = await User.countDocuments({ role: 'district_admin' });
const groupAdmins = await User.countDocuments({ role: 'group_admin' });

console.log('=== DB VERIFICATION ===');
console.log('Total Users:', total);
console.log('Active:', active);
console.log('Inactive:', inactive);
console.log('State Admins:', stateAdmins);
console.log('District Admins:', districtAdmins);
console.log('Group Admins:', groupAdmins);
console.log('Sum (state+district+group):', stateAdmins + districtAdmins + groupAdmins);

// Check for duplicates (same phone + same role)
const pipeline = [
  { $group: { _id: { phone: '$phone', role: '$role' }, count: { $sum: 1 }, names: { $push: '$name' } } },
  { $match: { count: { $gt: 1 } } }
];
const dupes = await User.aggregate(pipeline).toArray();
console.log('\n=== DUPLICATES (same phone + role) ===');
if (dupes.length === 0) console.log('None found ✅');
else dupes.forEach(d => console.log(' ', d._id.phone, d._id.role, '->', d.names.join(', '), '('+d.count+' records)'));

// Also check same phone appearing with multiple roles
const phoneMultiRole = [
  { $group: { _id: '$phone', roles: { $addToSet: '$role' }, count: { $sum: 1 }, names: { $push: '$name' } } },
  { $match: { count: { $gt: 1 } } }
];
const multiRole = await User.aggregate(phoneMultiRole).toArray();
console.log('\n=== SAME PHONE, MULTIPLE USER RECORDS ===');
if (multiRole.length === 0) console.log('None found ✅');
else multiRole.forEach(d => console.log(' ', d._id, '->', d.roles.join(', '), '-', d.names.join(', ')));

// List state admins
const stateAdminList = await User.find({ role: 'state_admin' }, { projection: { name: 1, phone: 1 } }).toArray();
console.log('\n=== STATE ADMINS LIST (' + stateAdminList.length + ') ===');
stateAdminList.forEach(u => console.log(' ', u.name, '-', u.phone));

await mongoose.disconnect();
