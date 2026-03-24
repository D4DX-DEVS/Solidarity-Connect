/**
 * Migration Script: Split Malappuram district into Malappuram East & Malappuram West
 *
 * Areas from CSV:
 *   West:  Alathiyur, AR Nagar, Edappal, Kottakkal, Parappur, Perumbapadapp,
 *           Ponnani, Puthanathani, Tanur, Tirur, Tirurangadi, University, Valanchery, Vengara
 *   East:  Areekode, Chunkathara, Edavanna, Karuvarakkundu, Kondotty, Makkarapparamba,
 *           Malappuram, Mampad, Manjeri, Nilambur, Padapparamba, Perinthalmanna,
 *           Shanthapuram, Tirurkkad, Velluvambram, Vazhakkad, Wandoor
 *
 * Usage:
 *   node migrate-malappuram.js            (dry run – shows what would change)
 *   node migrate-malappuram.js --execute  (actually applies changes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

// ─── Area Lists ───────────────────────────────────────────────────────────────
// Includes common spelling variants found in the database.
// Sorted longest-first so longer/more-specific strings match before shorter ones
// (e.g. "tirurkkad" before "tirur", "perumbapadap" before "parappur").
const WEST_AREAS = [
  // canonical names
  'perumbapadapp', 'puthanathani', 'tirurangadi', 'valanchery',
  'alathiyur', 'ar nagar', 'edappal', 'kottakkal', 'parappur',
  'ponnani', 'vengara', 'tanur', 'tirur', 'university',
  // alternate spellings / truncations found in DB
  'alathiyoo',     // ALATHIYOOR
  'perumbadappu',  // MARANCHERY-PERUMBADAPPU, PERUMBADAPP
  'perumbadap',    // catch-all for perumbapadapp variants
  'tanalur',       // TANALUR (near Tanur, West)
].sort((a, b) => b.length - a.length);

const EAST_AREAS = [
  // canonical names
  'karuvarakkundu', 'makkarapparamba', 'padapparamba', 'perinthalmanna',
  'shanthapuram', 'velluvambram', 'chunkathara', 'vazhakkad', 'areekode',
  'edavanna', 'kondotty', 'tirurkkad', 'wandoor', 'mampad', 'manjeri',
  'nilambur', 'malappuram',
  // alternate spellings / truncations found in DB
  'padapparamb',    // PADAPPARAMB
  'valluvambram',   // VALLUVAMBRAM (variant of velluvambram)
  'karuvarakkund',  // KARUVARAKKUND / KARUVARAKUNDU
  'karuvarakundu',
  'chungathara',    // CHUNGATHARA
  'makkaraparamba', // MAKKARAPARAMBA / MAKKARAPARAMB
  'makkaraparamb',
  'santhapuram',    // SANTHAPURAM
  'mambad',         // MAMBAD (variant of mampad)
  'areacode',       // AREACODE (variant of areekode)
  'vazhakad',       // VAZHAKAD (one k)
].sort((a, b) => b.length - a.length);

// ─── Mongoose Schemas (inline, lightweight) ──────────────────────────────────
const districtSchema = new mongoose.Schema({
  name: String, code: String, state: String, admin: mongoose.Schema.Types.ObjectId,
  isActive: Boolean, createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  statistics: { totalMembers: Number, activeMembers: Number, totalGroups: Number },
}, { timestamps: true });

const groupSchema = new mongoose.Schema({
  name: String, code: String,
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  admin: mongoose.Schema.Types.ObjectId, isActive: Boolean,
  createdBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const memberSchema = new mongoose.Schema({
  name: String, phone: String,
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  status: String, isApproved: Boolean, createdBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: String, phone: String, role: String,
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  isActive: Boolean,
}, { timestamps: true });

const District = mongoose.models.District || mongoose.model('District', districtSchema);
const Group    = mongoose.models.Group    || mongoose.model('Group', groupSchema);
const Member   = mongoose.models.Member   || mongoose.model('Member', memberSchema);
const User     = mongoose.models.User     || mongoose.model('User', userSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function classifyGroup(groupName) {
  const lower = groupName.toLowerCase();
  // Check East first for "malappuram" city disambiguation
  for (const area of EAST_AREAS) {
    if (lower.includes(area)) return { side: 'east', matchedArea: area };
  }
  for (const area of WEST_AREAS) {
    if (lower.includes(area)) return { side: 'west', matchedArea: area };
  }
  return { side: null, matchedArea: null };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n========================================================');
  console.log(DRY_RUN ? '  DRY RUN – no changes will be written' : '  EXECUTE MODE – changes WILL be written to MongoDB');
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // 1. Find the Malappuram district (case-insensitive)
  const malappuram = await District.findOne({ name: /^malappuram$/i });
  if (!malappuram) {
    const all = await District.find({}, 'name').lean();
    console.error('❌  Could not find a district named "Malappuram". Found districts:');
    all.forEach(d => console.log('   -', d.name));
    process.exit(1);
  }
  console.log(`✅ Found district: "${malappuram.name}" (${malappuram._id})\n`);

  // 2. Create Malappuram East & West
  const newDistrictBase = {
    state: malappuram.state || 'Kerala',
    isActive: true,
    createdBy: malappuram.createdBy,
    statistics: { totalMembers: 0, activeMembers: 0, totalGroups: 0 },
  };

  let eastDistrict, westDistrict;
  if (DRY_RUN) {
    console.log('📋 Would create: "Malappuram East" (code: MPLE)');
    console.log('📋 Would create: "Malappuram West" (code: MPLW)\n');
    eastDistrict = { _id: new mongoose.Types.ObjectId(), name: 'Malappuram East' };
    westDistrict = { _id: new mongoose.Types.ObjectId(), name: 'Malappuram West' };
  } else {
    // Check if they already exist
    eastDistrict = await District.findOne({ name: /^malappuram east$/i });
    westDistrict = await District.findOne({ name: /^malappuram west$/i });

    if (!eastDistrict) {
      eastDistrict = await District.create({ ...newDistrictBase, name: 'Malappuram East', code: 'MPLE' });
      console.log(`✅ Created "Malappuram East" (${eastDistrict._id})`);
    } else {
      console.log(`ℹ️  "Malappuram East" already exists (${eastDistrict._id})`);
    }

    if (!westDistrict) {
      westDistrict = await District.create({ ...newDistrictBase, name: 'Malappuram West', code: 'MPLW' });
      console.log(`✅ Created "Malappuram West" (${westDistrict._id})`);
    } else {
      console.log(`ℹ️  "Malappuram West" already exists (${westDistrict._id})`);
    }
    console.log();
  }

  // 3. Fetch all groups in Malappuram (no isActive filter – migrate all)
  const groups = await Group.find({ district: malappuram._id }).lean();
  console.log(`📦 Found ${groups.length} groups in Malappuram district\n`);

  const eastGroups   = [];
  const westGroups   = [];
  const unmatchedGroups = [];

  for (const group of groups) {
    const { side, matchedArea } = classifyGroup(group.name);
    if (side === 'east')  eastGroups.push({ group, matchedArea });
    else if (side === 'west') westGroups.push({ group, matchedArea });
    else unmatchedGroups.push(group);
  }

  console.log(`🟢 Malappuram East (${eastGroups.length} groups):`);
  eastGroups.forEach(({ group, matchedArea }) =>
    console.log(`   • ${group.name}  [area: ${matchedArea}]`));

  console.log(`\n🔵 Malappuram West (${westGroups.length} groups):`);
  westGroups.forEach(({ group, matchedArea }) =>
    console.log(`   • ${group.name}  [area: ${matchedArea}]`));

  if (unmatchedGroups.length > 0) {
    console.log(`\n⚠️  Unmatched groups (${unmatchedGroups.length}) – REQUIRE MANUAL REVIEW:`);
    unmatchedGroups.forEach(g => console.log(`   • ${g.name} (${g._id})`));
  }

  // 4. Apply group migrations
  let groupsUpdated = 0, membersUpdated = 0;

  const applyGroupMigration = async (groupList, targetDistrict) => {
    for (const { group } of groupList) {
      const memberCount = await Member.countDocuments({ group: group._id });
      if (DRY_RUN) {
        console.log(`\n   [DRY] Group "${group.name}" → ${targetDistrict.name}`);
        console.log(`         + ${memberCount} members would be updated`);
        groupsUpdated++;
        membersUpdated += memberCount;
      } else {
        await Group.updateOne({ _id: group._id }, { $set: { district: targetDistrict._id } });
        const result = await Member.updateMany({ group: group._id }, { $set: { district: targetDistrict._id } });
        console.log(`   ✅ Group "${group.name}" → ${targetDistrict.name} | ${result.modifiedCount} members updated`);
        groupsUpdated++;
        membersUpdated += result.modifiedCount;
      }
    }
  };

  console.log('\n─── Applying group migrations ───────────────────────────');
  await applyGroupMigration(eastGroups, eastDistrict);
  await applyGroupMigration(westGroups, westDistrict);

  // 5. Report district_admin users assigned to old Malappuram district
  const districtAdmins = await User.find({ district: malappuram._id, role: 'district_admin' }, 'name phone').lean();
  if (districtAdmins.length > 0) {
    console.log(`\n⚠️  District admin users still pointing to old Malappuram (${districtAdmins.length}):`);
    districtAdmins.forEach(u => console.log(`   • ${u.name} (${u.phone})`));
    console.log('   → Reassign these users to East or West via the admin panel.');
  }

  // 6. Summary
  console.log('\n========================================================');
  console.log('  MIGRATION SUMMARY');
  console.log('========================================================');
  console.log(`  Groups migrated   : ${groupsUpdated}`);
  console.log(`    • to East       : ${eastGroups.length}`);
  console.log(`    • to West       : ${westGroups.length}`);
  console.log(`    • unmatched     : ${unmatchedGroups.length} (manual action needed)`);
  console.log(`  Members updated   : ${membersUpdated}`);
  if (DRY_RUN) {
    console.log('\n  ⚡ This was a DRY RUN. Re-run with --execute to apply changes.');
  } else {
    console.log('\n  ✅ Migration complete!');
    console.log('  ℹ️  The original "Malappuram" district is still in the DB.');
    console.log('      After verifying the migration, delete it via the admin panel.');
    if (districtAdmins.length > 0) {
      console.log('  ⚠️  Remember to reassign the district admin users listed above.');
    }
  }
  console.log('========================================================\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
