import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Member from '../models/Member.js';
import District from '../models/District.js';
import Group from '../models/Group.js';

// Backfill roleTag for leaders that were marked isLeader but never given a role
// tag in Role Management (they showed blank type/area on the Leaders page).
// Derives: group_admin -> area(group name), district_admin -> district(district
// name), state_admin -> state. Members marked isLeader default to area(group).
// Usage: node src/utils/backfillRoleTags.js
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const fix = async (Model, label) => {
    const docs = await Model.find({
      isLeader: true,
      $or: [{ roleTag: { $exists: false } }, { 'roleTag.type': { $in: [null, ''] } }, { 'roleTag.type': { $exists: false } }],
    })
      .populate('district', 'name')
      .populate('group', 'name');

    let fixed = 0;
    for (const doc of docs) {
      const role = doc.role || 'member';
      let tag;
      if (role === 'state_admin') {
        tag = { type: 'state' };
      } else if (role === 'district_admin') {
        tag = { type: 'district', name: doc.district?.name };
      } else {
        // group_admin and leader-flagged members belong to an area
        tag = { type: 'area', name: doc.group?.name || doc.district?.name, areaId: doc.group?._id };
      }
      // updateOne, not save(): some legacy docs fail unrelated required-field
      // validation (e.g. group_admin with no group) and save() would crash.
      await Model.updateOne(
        { _id: doc._id },
        { $set: { roleTag: { ...tag, listingOrder: doc.roleTag?.listingOrder ?? null } } }
      );
      fixed++;
      console.log(`  ✅ ${doc.name} (${doc.phone}) [${role}] -> ${tag.type}${tag.name ? ` / ${tag.name}` : ''}`);
    }
    console.log(`${label}: ${fixed} fixed of ${docs.length} untagged leaders`);
  };

  console.log('Backfilling User leaders…');
  await fix(User, 'Users');
  console.log('Backfilling Member leaders…');
  await fix(Member, 'Members');

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('❌ Backfill failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
