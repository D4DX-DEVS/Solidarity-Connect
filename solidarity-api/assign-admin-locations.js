import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function assignAdminLocations() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const Member = mongoose.model('Member', new mongoose.Schema({}, { strict: false }), 'members');
    const Group = mongoose.model('Group', new mongoose.Schema({}, { strict: false }), 'groups');

    // Find all group_admins missing group field
    const adminsWithoutGroup = await User.find({
      role: 'group_admin',
      $or: [{ group: null }, { group: { $exists: false } }]
    }).lean();

    console.log(`\n🔍 Found ${adminsWithoutGroup.length} group_admins without group assigned\n`);

    let fixed = 0;
    let notFound = 0;

    for (const admin of adminsWithoutGroup) {
      const phone = admin.phone;
      const phoneVariants = [
        phone,
        phone?.startsWith('+91') ? phone.slice(3) : `+91${phone}`,
        phone?.startsWith('+91') ? phone : phone
      ];

      // Strategy 1: Check if any Group has this user as admin
      let group = await Group.findOne({ admin: admin._id }).lean();

      // Strategy 2: Find group by matching phone in members
      if (!group) {
        const member = await Member.findOne({
          phone: { $in: phoneVariants },
          status: 'Active'
        }).lean();

        if (member && member.group) {
          group = await Group.findById(member.group).lean();
        }
      }

      // Strategy 3: Check if admin name matches any group admin reference
      if (!group) {
        // Find groups in the same district that don't have an admin assigned
        const member = await Member.findOne({
          phone: { $in: phoneVariants }
        }).lean();

        if (member && member.group) {
          group = await Group.findById(member.group).lean();
        }
      }

      if (group) {
        await User.updateOne(
          { _id: admin._id },
          { $set: { group: group._id, district: group.district } }
        );
        console.log(`✅ ${admin.name} (${phone}) → Group: ${group.name || group._id}`);
        fixed++;
      } else {
        console.log(`❌ ${admin.name} (${phone}) → No group found`);
        notFound++;
      }
    }

    // Also fix district_admins missing district
    const adminsWithoutDistrict = await User.find({
      role: 'district_admin',
      $or: [{ district: null }, { district: { $exists: false } }]
    }).lean();

    console.log(`\n🔍 Found ${adminsWithoutDistrict.length} district_admins without district assigned\n`);

    for (const admin of adminsWithoutDistrict) {
      const phone = admin.phone;
      const phoneVariants = [
        phone,
        phone?.startsWith('+91') ? phone.slice(3) : `+91${phone}`,
        phone?.startsWith('+91') ? phone : phone
      ];

      const member = await Member.findOne({
        phone: { $in: phoneVariants }
      }).lean();

      if (member && member.district) {
        await User.updateOne(
          { _id: admin._id },
          { $set: { district: member.district } }
        );
        console.log(`✅ ${admin.name} (${phone}) → District: ${member.district}`);
        fixed++;
      } else {
        console.log(`❌ ${admin.name} (${phone}) → No district found`);
        notFound++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Not found: ${notFound}`);
    console.log(`   Total processed: ${fixed + notFound}`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

assignAdminLocations();
