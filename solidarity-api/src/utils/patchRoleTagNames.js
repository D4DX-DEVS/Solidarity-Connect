import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import District from '../models/District.js';
import Group from '../models/Group.js';

// One-off: area-tagged leaders saved without a name (no group on the doc when
// the first backfill ran) get their name from group, falling back to district.
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await User.find({
    isLeader: true,
    'roleTag.type': 'area',
    $or: [{ 'roleTag.name': { $exists: false } }, { 'roleTag.name': null }, { 'roleTag.name': '' }],
  })
    .populate('district', 'name')
    .populate('group', 'name');

  let n = 0;
  for (const d of docs) {
    const name = d.group?.name || d.district?.name;
    if (!name) continue;
    await User.updateOne(
      { _id: d._id },
      { $set: { 'roleTag.name': name, ...(d.group ? { 'roleTag.areaId': d.group._id } : {}) } }
    );
    console.log('fixed name:', d.name, '->', name);
    n++;
  }
  console.log(`${n} names patched; ${docs.length - n} still nameless (no group/district on record)`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('❌ Patch failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
