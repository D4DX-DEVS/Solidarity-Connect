/**
 * Migration Script: Import district and state leaders
 *
 * Sources:
 *   - leaders-Dis.json   → district leaders  (roleTag.type = 'district')
 *   - state.json         → state leaders     (roleTag.type = 'state')
 *
 * Logic:
 *   For each entry, look up the phone number in the Member collection.
 *   If found → set isLeader=true, roleTag = { type, name }.
 *   If NOT found as a Member → check the User collection.
 *   If found as a User → set isLeader=true, roleTag = { type, name }.
 *   Otherwise → report as NOT FOUND.
 *
 * Usage:
 *   node migrate-leaders.js            (dry run)
 *   node migrate-leaders.js --execute  (apply changes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

// ─── Schemas ─────────────────────────────────────────────────────────────────
const memberSchema = new mongoose.Schema({
  name: String, phone: String,
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  isLeader: Boolean,
  roleTag: { type: { type: String }, name: String, roleDescription: String },
  status: String, isApproved: Boolean,
}, { timestamps: true, strict: false });

const userSchema = new mongoose.Schema({
  name: String, phone: String, role: String,
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  isLeader: Boolean,
  roleTag: { type: { type: String }, name: String, roleDescription: String },
  isActive: Boolean,
}, { timestamps: true, strict: false });

const districtSchema = new mongoose.Schema({ name: String, code: String }, { timestamps: true });
const groupSchema2 = new mongoose.Schema({ name: String, code: String, district: mongoose.Schema.Types.ObjectId }, { timestamps: true });

const Member   = mongoose.models.Member   || mongoose.model('Member', memberSchema);
const User     = mongoose.models.User     || mongoose.model('User', userSchema);
const District = mongoose.models.District || mongoose.model('District', districtSchema);
const Group    = mongoose.models.Group    || mongoose.model('Group', groupSchema2);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').replace(/^0+/, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  return p; // 10-digit number
}

async function findByPhone(phone10) {
  // Try multiple formats: raw, +91 prefix
  const variants = [phone10, `+91${phone10}`, `91${phone10}`];

  let member = await Member.findOne({ phone: { $in: variants } })
    .populate('district', 'name')
    .populate('group', 'name');
  if (member) return { target: member, collection: 'Member' };

  let user = await User.findOne({ phone: { $in: variants } })
    .populate('district', 'name')
    .populate('group', 'name');
  if (user) return { target: user, collection: 'User' };

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n========================================================');
  console.log(DRY_RUN ? '  DRY RUN – no changes will be written' : '  EXECUTE MODE – changes WILL be written');
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // Load JSON files
  const projectRoot = join(__dirname, '..');
  const districtLeaders = JSON.parse(readFileSync(join(projectRoot, 'leaders-Dis.json'), 'utf-8'));
  const stateLeaders    = JSON.parse(readFileSync(join(projectRoot, 'state.json'), 'utf-8'));

  // Load all districts for name-matching (needed for district leader verification)
  const allDistricts = await District.find({}, 'name').lean();
  const districtNameMap = {};
  for (const d of allDistricts) {
    districtNameMap[d.name.toLowerCase()] = d;
  }

  console.log(`📋 District leaders to process: ${districtLeaders.length}`);
  console.log(`📋 State leaders to process:    ${stateLeaders.length}\n`);

  const stats = {
    memberUpdated: 0,
    userUpdated: 0,
    notFound: 0,
    districtMismatch: 0,
    alreadyLeader: 0,
  };

  const notFoundList = [];
  const mismatchList = [];

  // ─── Process District Leaders ──────────────────────────────────────────────
  console.log('═══ DISTRICT LEADERS ═════════════════════════════════════\n');

  for (const entry of districtLeaders) {
    const phone10 = normalizePhone(entry.Phone);
    const result = await findByPhone(phone10);

    if (!result) {
      stats.notFound++;
      notFoundList.push({ ...entry, level: 'district' });
      console.log(`   ❌ NOT FOUND: ${entry.Name} (${phone10}) — ${entry.DISTRICT} / ${entry.Role}`);
      continue;
    }

    const { target, collection } = result;
    const tag = `[${collection}]`;

    // Check if the member's current district matches the expected district
    const expectedDistrictName = entry.DISTRICT.toLowerCase();
    const actualDistrictName = target.district?.name?.toLowerCase() || '(no district)';
    const districtMatch = actualDistrictName === expectedDistrictName ||
      actualDistrictName.includes(expectedDistrictName) ||
      expectedDistrictName.includes(actualDistrictName);

    if (!districtMatch && target.district) {
      stats.districtMismatch++;
      mismatchList.push({
        name: entry.Name, phone: phone10, expected: entry.DISTRICT,
        actual: target.district?.name, role: entry.Role, collection,
      });
    }

    // Check if already a leader with same role
    if (target.isLeader && target.roleTag?.type === 'district' && target.roleTag?.name === entry.Role) {
      stats.alreadyLeader++;
      console.log(`   ⏭️  ${tag} ${entry.Name} — already district leader: ${entry.Role}`);
      continue;
    }

    if (DRY_RUN) {
      const distInfo = target.district?.name || '(no district)';
      console.log(`   📋 ${tag} ${entry.Name} (${phone10}) — would set: district leader "${entry.Role}" [current district: ${distInfo}]`);
    } else {
      const Model = collection === 'Member' ? Member : User;
      await Model.updateOne(
        { _id: target._id },
        {
          $set: {
            isLeader: true,
            'roleTag.type': 'district',
            'roleTag.name': entry.Role,
          }
        }
      );
      console.log(`   ✅ ${tag} ${entry.Name} → district leader "${entry.Role}"`);
    }
    if (collection === 'Member') stats.memberUpdated++;
    else stats.userUpdated++;
  }

  // ─── Process State Leaders ─────────────────────────────────────────────────
  console.log('\n═══ STATE LEADERS ════════════════════════════════════════\n');

  for (const entry of stateLeaders) {
    const phone10 = normalizePhone(entry.Phone);
    const result = await findByPhone(phone10);

    if (!result) {
      stats.notFound++;
      notFoundList.push({ ...entry, level: 'state' });
      console.log(`   ❌ NOT FOUND: ${entry.Name} (${phone10}) — ${entry.Role}`);
      continue;
    }

    const { target, collection } = result;
    const tag = `[${collection}]`;

    // Check if already a leader with same role
    if (target.isLeader && target.roleTag?.type === 'state' && target.roleTag?.name === entry.Role) {
      stats.alreadyLeader++;
      console.log(`   ⏭️  ${tag} ${entry.Name} — already state leader: ${entry.Role}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`   📋 ${tag} ${entry.Name} (${phone10}) — would set: state leader "${entry.Role}"`);
    } else {
      const Model = collection === 'Member' ? Member : User;
      await Model.updateOne(
        { _id: target._id },
        {
          $set: {
            isLeader: true,
            'roleTag.type': 'state',
            'roleTag.name': entry.Role,
          }
        }
      );
      console.log(`   ✅ ${tag} ${entry.Name} → state leader "${entry.Role}"`);
    }
    if (collection === 'Member') stats.memberUpdated++;
    else stats.userUpdated++;
  }

  // ─── District Mismatch Report ──────────────────────────────────────────────
  if (mismatchList.length > 0) {
    console.log('\n⚠️  DISTRICT MISMATCH WARNINGS (leader assigned but district differs):');
    for (const m of mismatchList) {
      console.log(`   • ${m.name} (${m.phone}) [${m.collection}]: expected "${m.expected}" but is in "${m.actual}" — role: ${m.role}`);
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log('  LEADER MIGRATION SUMMARY');
  console.log('========================================================');
  console.log(`  Members updated as leaders : ${stats.memberUpdated}`);
  console.log(`  Users updated as leaders   : ${stats.userUpdated}`);
  console.log(`  Already leaders (skipped)  : ${stats.alreadyLeader}`);
  console.log(`  Not found in DB            : ${stats.notFound}`);
  console.log(`  District mismatches        : ${stats.districtMismatch}`);
  if (notFoundList.length > 0) {
    console.log(`\n  ❌ NOT FOUND entries (${notFoundList.length}):`);
    for (const nf of notFoundList) {
      const dist = nf.DISTRICT || 'State';
      console.log(`     • ${nf.Name} (${normalizePhone(nf.Phone)}) — ${dist} / ${nf.Role}`);
    }
  }
  if (DRY_RUN) {
    console.log('\n  ⚡ This was a DRY RUN. Re-run with --execute to apply changes.');
  } else {
    console.log('\n  ✅ Leader migration complete!');
  }
  console.log('========================================================\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
