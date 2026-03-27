/**
 * Migration Script: Import area leaders for Malappuram East & West
 *
 * Source: malappuram-area.json
 *
 * Logic:
 *   For each entry (President or Secretary of an area):
 *     1. Look up phone in Member collection → set isLeader=true, roleTag (type='area')
 *     2. If not in Member → check User collection → same update + roleTag.areaId
 *     3. The Group is looked up by area name within the correct district
 *        (Malappuram East or Malappuram West)
 *
 * Usage:
 *   node migrate-area-leaders.js             (dry run – shows what would change)
 *   node migrate-area-leaders.js --execute   (apply changes)
 *   node migrate-area-leaders.js --verify    (check migration completeness)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN   = !process.argv.includes('--execute') && !process.argv.includes('--verify');
const VERIFY    = process.argv.includes('--verify');

// ─── Schemas ──────────────────────────────────────────────────────────────────
const districtSchema = new mongoose.Schema({ name: String, code: String }, { strict: false, timestamps: true });
const groupSchema    = new mongoose.Schema({ name: String, code: String, district: mongoose.Schema.Types.ObjectId }, { strict: false, timestamps: true });

const memberSchema = new mongoose.Schema({
  name: String, phone: String,
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  group:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  isLeader: Boolean,
  roleTag: { type: { type: String }, name: String, roleDescription: String },
}, { timestamps: true, strict: false });

const userSchema = new mongoose.Schema({
  name: String, phone: String, role: String,
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  group:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  isLeader: Boolean,
  roleTag: {
    type: { type: String },
    name: String,
    areaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    roleDescription: String,
  },
  isActive: Boolean,
}, { timestamps: true, strict: false });

const District = mongoose.models.District || mongoose.model('District', districtSchema);
const Group    = mongoose.models.Group    || mongoose.model('Group', groupSchema);
const Member   = mongoose.models.Member   || mongoose.model('Member', memberSchema);
const User     = mongoose.models.User     || mongoose.model('User', userSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').replace(/^0+/, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  return p; // 10-digit
}

async function findByPhone(phone10) {
  const variants = [phone10, `+91${phone10}`, `91${phone10}`];

  const member = await Member.findOne({ phone: { $in: variants } })
    .populate('district', 'name')
    .populate('group', 'name');
  if (member) return { target: member, collection: 'Member' };

  const user = await User.findOne({ phone: { $in: variants } })
    .populate('district', 'name')
    .populate('group', 'name');
  if (user) return { target: user, collection: 'User' };

  return null;
}

/** Find the Group whose name contains the area keyword in the given district. */
async function findGroupByArea(areaName, districtId) {
  // Build a regex from the area name for flexible matching
  const regex = new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const group = await Group.findOne({ district: districtId, name: regex });
  return group || null;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n========================================================');
  if (VERIFY) {
    console.log('  VERIFY MODE – checking migration completeness');
  } else {
    console.log(DRY_RUN ? '  DRY RUN – no changes will be written' : '  EXECUTE MODE – changes WILL be written');
  }
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // ─── VERIFY MODE ──────────────────────────────────────────────────────────
  if (VERIFY) {
    await runVerify();
    await mongoose.disconnect();
    return;
  }

  // Load source JSON
  const projectRoot = join(__dirname, '..');
  const entries = JSON.parse(readFileSync(join(projectRoot, 'malappuram-area.json'), 'utf-8'));

  // Find Malappuram East & West districts
  const eastDistrict = await District.findOne({ name: /^malappuram east$/i });
  const westDistrict = await District.findOne({ name: /^malappuram west$/i });

  if (!eastDistrict) { console.error('❌  "Malappuram East" district not found. Run migrate-malappuram.js --execute first.'); process.exit(1); }
  if (!westDistrict) { console.error('❌  "Malappuram West" district not found. Run migrate-malappuram.js --execute first.'); process.exit(1); }

  console.log(`✅ Malappuram East  (${eastDistrict._id})`);
  console.log(`✅ Malappuram West  (${westDistrict._id})\n`);
  console.log(`📋 Total entries to process: ${entries.length}\n`);

  const stats = { memberUpdated: 0, userUpdated: 0, notFound: 0, groupNotFound: 0, alreadySet: 0 };
  const notFoundList     = [];
  const groupMissingList = [];

  for (const entry of entries) {
    const phone10    = normalizePhone(entry.mobile);
    const areaName   = entry.Area.trim();
    const role       = entry.Role.trim();        // "President" or "SECRETARY"
    const distLabel  = entry.district.trim().toLowerCase(); // "malappuram east" / "malappuram west"
    const targetDist = distLabel.includes('east') ? eastDistrict : westDistrict;

    // Find person
    const result = await findByPhone(phone10);
    if (!result) {
      stats.notFound++;
      notFoundList.push(entry);
      console.log(`   ❌ NOT FOUND: ${entry.Name} (${phone10}) — ${targetDist.name} / ${areaName} / ${role}`);
      continue;
    }

    const { target, collection } = result;

    // Find the matching Group/area in the correct district
    const group = await findGroupByArea(areaName, targetDist._id);
    if (!group) {
      stats.groupNotFound++;
      groupMissingList.push({ ...entry, phone10 });
      console.log(`   ⚠️  GROUP NOT FOUND: ${entry.Name} (${phone10}) — area "${areaName}" not found in ${targetDist.name}`);
      // Still set the leader tag (with roleDescription) even if group not found
    }

    // Skip if already set correctly
    if (
      target.isLeader &&
      target.roleTag?.type === 'area' &&
      target.roleTag?.name?.toLowerCase() === role.toLowerCase() &&
      target.roleTag?.roleDescription?.toLowerCase() === areaName.toLowerCase()
    ) {
      stats.alreadySet++;
      console.log(`   ⏭️  [${collection}] ${entry.Name} — already area leader (${areaName} / ${role})`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`   📋 [${collection}] ${entry.Name} (${phone10}) → area leader "${role}" of ${areaName} [${targetDist.name}]${group ? '' : ' ⚠️ group not found'}`);
    } else {
      const Model = collection === 'Member' ? Member : User;

      const roleTagUpdate = {
        isLeader: true,
        'roleTag.type': 'area',
        'roleTag.name': role,
        'roleTag.roleDescription': areaName,
      };

      // For User records, also set areaId to the Group ObjectId
      if (collection === 'User' && group) {
        roleTagUpdate['roleTag.areaId'] = group._id;
      }

      await Model.updateOne({ _id: target._id }, { $set: roleTagUpdate });
      console.log(`   ✅ [${collection}] ${entry.Name} → area leader "${role}" of ${areaName} [${targetDist.name}]${group ? '' : ' ⚠️ no group linked'}`);
    }

    if (collection === 'Member') stats.memberUpdated++;
    else stats.userUpdated++;
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log('  AREA LEADER MIGRATION SUMMARY');
  console.log('========================================================');
  console.log(`  Members set as area leaders : ${stats.memberUpdated}`);
  console.log(`  Users set as area leaders   : ${stats.userUpdated}`);
  console.log(`  Already set (skipped)       : ${stats.alreadySet}`);
  console.log(`  Person not found in DB      : ${stats.notFound}`);
  console.log(`  Group/area not found in DB  : ${stats.groupNotFound}`);

  if (notFoundList.length > 0) {
    console.log(`\n  ❌ NOT FOUND (${notFoundList.length}) — need to register first:`);
    for (const nf of notFoundList) {
      console.log(`     • ${nf.Name} (${normalizePhone(nf.mobile)}) — ${nf.district} / ${nf.Area} / ${nf.Role}`);
    }
  }

  if (groupMissingList.length > 0) {
    console.log(`\n  ⚠️  GROUP NOT IN DB (${groupMissingList.length}) — roleTag set without areaId:`);
    for (const g of groupMissingList) {
      console.log(`     • ${g.Name} — area "${g.Area}" not found in ${g.district}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n  ⚡ Dry run. Re-run with --execute to apply changes.');
    console.log('  ⚡ Re-run with --verify after executing to confirm completeness.');
  } else {
    console.log('\n  ✅ Area leader migration complete!');
    console.log('  ℹ️  Run with --verify to confirm all leaders are set correctly.');
  }
  console.log('========================================================\n');

  await mongoose.disconnect();
}

// ─── Verify ───────────────────────────────────────────────────────────────────
async function runVerify() {
  const projectRoot = join(__dirname, '..');
  const entries = JSON.parse(readFileSync(join(projectRoot, 'malappuram-area.json'), 'utf-8'));

  const eastDistrict = await District.findOne({ name: /^malappuram east$/i }).lean();
  const westDistrict = await District.findOne({ name: /^malappuram west$/i }).lean();
  const oldMalappuram = await District.findOne({ name: /^malappuram$/i }).lean();

  console.log('─── District Check ──────────────────────────────────────');
  console.log(`  Malappuram East : ${eastDistrict ? `✅ exists (${eastDistrict._id})` : '❌ NOT FOUND'}`);
  console.log(`  Malappuram West : ${westDistrict ? `✅ exists (${westDistrict._id})` : '❌ NOT FOUND'}`);
  console.log(`  Old Malappuram  : ${oldMalappuram ? `⚠️  still exists (${oldMalappuram._id})` : '✅ removed / not present'}`);

  // Count area leaders per district
  const eastIds = eastDistrict ? [eastDistrict._id] : [];
  const westIds = westDistrict ? [westDistrict._id] : [];
  const oldIds  = oldMalappuram ? [oldMalappuram._id] : [];

  const [eastMemberLeaders, eastUserLeaders, westMemberLeaders, westUserLeaders, oldMemberLeaders, oldUserLeaders] = await Promise.all([
    Member.countDocuments({ district: { $in: eastIds }, isLeader: true, 'roleTag.type': 'area' }),
    User.countDocuments({ district: { $in: eastIds }, isLeader: true, 'roleTag.type': 'area' }),
    Member.countDocuments({ district: { $in: westIds }, isLeader: true, 'roleTag.type': 'area' }),
    User.countDocuments({ district: { $in: westIds }, isLeader: true, 'roleTag.type': 'area' }),
    Member.countDocuments({ district: { $in: oldIds }, isLeader: true, 'roleTag.type': 'area' }),
    User.countDocuments({ district: { $in: oldIds }, isLeader: true, 'roleTag.type': 'area' }),
  ]);

  console.log('\n─── Area Leader Counts ──────────────────────────────────');
  console.log(`  Malappuram East  : ${eastMemberLeaders} members + ${eastUserLeaders} users = ${eastMemberLeaders + eastUserLeaders} area leaders`);
  console.log(`  Malappuram West  : ${westMemberLeaders} members + ${westUserLeaders} users = ${westMemberLeaders + westUserLeaders} area leaders`);
  if (oldMalappuram) {
    console.log(`  Old Malappuram   : ${oldMemberLeaders} members + ${oldUserLeaders} users = ${oldMemberLeaders + oldUserLeaders} area leaders${(oldMemberLeaders + oldUserLeaders) > 0 ? ' ⚠️  (should be 0)' : ' ✅'}`);
  }

  // Check per-entry status
  console.log('\n─── Per-Entry Status ────────────────────────────────────');
  let missing = 0, found = 0, wrongRole = 0;

  for (const entry of entries) {
    const phone10 = normalizePhone(entry.mobile);
    const variants = [phone10, `+91${phone10}`, `91${phone10}`];
    const role = entry.Role.trim();

    const member = await Member.findOne({ phone: { $in: variants } }).lean();
    const user   = !member ? await User.findOne({ phone: { $in: variants } }).lean() : null;
    const target = member || user;

    if (!target) {
      missing++;
      console.log(`   ❌ NOT IN DB : ${entry.Name} (${phone10}) — ${entry.district} / ${entry.Area} / ${role}`);
      continue;
    }

    const isCorrect =
      target.isLeader === true &&
      target.roleTag?.type === 'area' &&
      target.roleTag?.name?.toLowerCase() === role.toLowerCase() &&
      target.roleTag?.roleDescription?.toLowerCase() === entry.Area.toLowerCase();

    if (!isCorrect) {
      wrongRole++;
      console.log(`   ⚠️  MISMATCH  : ${entry.Name} (${phone10}) — expected area/${role}/${entry.Area}, got isLeader=${target.isLeader} type=${target.roleTag?.type} name=${target.roleTag?.name} area=${target.roleTag?.roleDescription}`);
    } else {
      found++;
    }
  }

  console.log('\n─── Summary ─────────────────────────────────────────────');
  console.log(`  ✅ Correctly migrated : ${found} / ${entries.length}`);
  console.log(`  ⚠️  Role mismatch      : ${wrongRole}`);
  console.log(`  ❌ Not in DB          : ${missing}`);

  if (found === entries.length) {
    console.log('\n  🎉 All area leaders migrated successfully!');
  } else {
    console.log(`\n  ⚠️  ${entries.length - found} entries need attention.`);
  }
  console.log('========================================================\n');
}

run().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
