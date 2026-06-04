/**
 * CLEANUP Script: Revert incorrect admin promotions
 *
 * Only these should be admins:
 *   - state_admin: 3 people from admins-st.json
 *   - district_admin: 15 people from admin-dis.json
 *
 * Actions:
 *   1. state_admin records NOT in admins-st.json → revert to group_admin or delete
 *   2. district_admin records NOT in admin-dis.json → revert to group_admin or delete
 *   3. Remove test accounts (9876543xxx)
 *
 * Usage:
 *   node cleanup-admins.js            (dry run)
 *   node cleanup-admins.js --execute  (apply changes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

await mongoose.connect(process.env.MONGODB_URI);
console.log('\n========================================================');
console.log(DRY_RUN ? '  DRY RUN – no changes will be written' : '  EXECUTE MODE – changes WILL be written');
console.log('========================================================\n');

const User = mongoose.connection.collection('users');

// Load legitimate admin lists
const projectRoot = join(__dirname, '..');
const stateAdminsJson = JSON.parse(readFileSync(join(projectRoot, 'admins-st.json'), 'utf-8'));
const districtAdminsJson = JSON.parse(readFileSync(join(projectRoot, 'admin-dis.json'), 'utf-8'));

function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').replace(/^0+/, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  return p;
}

const legitimateStatePhones = stateAdminsJson.map(e => normalizePhone(e.Phone));
const legitimateDistrictPhones = districtAdminsJson.map(e => normalizePhone(e.Phone));

console.log(`Legitimate state_admin phones (${legitimateStatePhones.length}):`, legitimateStatePhones.join(', '));
console.log(`Legitimate district_admin phones (${legitimateDistrictPhones.length}):`, legitimateDistrictPhones.join(', '));

const stats = { reverted: 0, deleted: 0, testDeleted: 0 };

// ─── 1. Fix state_admin records ──────────────────────────────────────────────
console.log('\n═══ FIXING STATE ADMINS ═══════════════════════════════════\n');

const allStateAdmins = await User.find({ role: 'state_admin' }).toArray();
for (const user of allStateAdmins) {
  const phone = normalizePhone(user.phone);
  if (legitimateStatePhones.includes(phone)) {
    console.log(`   ✅ KEEP: ${user.name} (${user.phone}) — legitimate state_admin`);
    continue;
  }

  // Test account?
  if (phone.startsWith('987654')) {
    if (DRY_RUN) {
      console.log(`   🗑️  Would DELETE test account: ${user.name} (${user.phone})`);
    } else {
      await User.deleteOne({ _id: user._id });
      console.log(`   🗑️  DELETED test account: ${user.name} (${user.phone})`);
    }
    stats.testDeleted++;
    continue;
  }

  // Check if this person has another User record (e.g. group_admin)
  const otherRecord = await User.findOne({ phone: user.phone, role: { $ne: 'state_admin' } });

  if (otherRecord) {
    // They have another record, just delete this wrongly-created state_admin
    if (DRY_RUN) {
      console.log(`   🗑️  Would DELETE extra state_admin: ${user.name} (${user.phone}) — has ${otherRecord.role} record`);
    } else {
      await User.deleteOne({ _id: user._id });
      console.log(`   🗑️  DELETED extra state_admin: ${user.name} (${user.phone}) — has ${otherRecord.role} record`);
    }
    stats.deleted++;
  } else {
    // This was upgraded FROM group_admin → revert back
    if (DRY_RUN) {
      console.log(`   ↩️  Would REVERT to group_admin: ${user.name} (${user.phone})`);
    } else {
      await User.updateOne({ _id: user._id }, { $set: { role: 'group_admin' }, $unset: { 'roleTag': '' } });
      console.log(`   ↩️  REVERTED to group_admin: ${user.name} (${user.phone})`);
    }
    stats.reverted++;
  }
}

// ─── 2. Fix district_admin records ───────────────────────────────────────────
console.log('\n═══ FIXING DISTRICT ADMINS ════════════════════════════════\n');

const allDistrictAdmins = await User.find({ role: 'district_admin' }).toArray();
for (const user of allDistrictAdmins) {
  const phone = normalizePhone(user.phone);
  if (legitimateDistrictPhones.includes(phone)) {
    console.log(`   ✅ KEEP: ${user.name} (${user.phone}) — legitimate district_admin`);
    continue;
  }

  // Test account?
  if (phone.startsWith('987654')) {
    if (DRY_RUN) {
      console.log(`   🗑️  Would DELETE test account: ${user.name} (${user.phone})`);
    } else {
      await User.deleteOne({ _id: user._id });
      console.log(`   🗑️  DELETED test account: ${user.name} (${user.phone})`);
    }
    stats.testDeleted++;
    continue;
  }

  // Check if this person has another User record (group_admin or state_admin)
  const otherRecord = await User.findOne({ phone: user.phone, role: { $ne: 'district_admin' } });

  if (otherRecord) {
    // They have another record, just delete this wrongly-created district_admin
    if (DRY_RUN) {
      console.log(`   🗑️  Would DELETE extra district_admin: ${user.name} (${user.phone}) — has ${otherRecord.role} record`);
    } else {
      await User.deleteOne({ _id: user._id });
      console.log(`   🗑️  DELETED extra district_admin: ${user.name} (${user.phone}) — has ${otherRecord.role} record`);
    }
    stats.deleted++;
  } else {
    // This was upgraded FROM group_admin → revert back
    if (DRY_RUN) {
      console.log(`   ↩️  Would REVERT to group_admin: ${user.name} (${user.phone})`);
    } else {
      await User.updateOne({ _id: user._id }, { $set: { role: 'group_admin' }, $unset: { 'roleTag': '' } });
      console.log(`   ↩️  REVERTED to group_admin: ${user.name} (${user.phone})`);
    }
    stats.reverted++;
  }
}

// ─── 3. Also delete any remaining test accounts (group_admin with 9876543xxx) ─
console.log('\n═══ REMAINING TEST ACCOUNTS ══════════════════════════════\n');
const testAccounts = await User.find({ phone: { $regex: /^987654/ } }).toArray();
if (testAccounts.length === 0) {
  console.log('   None found.');
} else {
  for (const user of testAccounts) {
    if (DRY_RUN) {
      console.log(`   🗑️  Would DELETE test: ${user.name} (${user.phone}) [${user.role}]`);
    } else {
      await User.deleteOne({ _id: user._id });
      console.log(`   🗑️  DELETED test: ${user.name} (${user.phone}) [${user.role}]`);
    }
    stats.testDeleted++;
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const finalTotal = await User.countDocuments({});
const finalState = await User.countDocuments({ role: 'state_admin' });
const finalDistrict = await User.countDocuments({ role: 'district_admin' });
const finalGroup = await User.countDocuments({ role: 'group_admin' });

console.log('\n========================================================');
console.log('  CLEANUP SUMMARY');
console.log('========================================================');
console.log(`  Reverted to group_admin : ${stats.reverted}`);
console.log(`  Deleted extra records   : ${stats.deleted}`);
console.log(`  Test accounts removed   : ${stats.testDeleted}`);
console.log(`\n  CURRENT DB COUNTS${DRY_RUN ? ' (before cleanup)' : ' (after cleanup)'}:`);
console.log(`    Total Users     : ${finalTotal}`);
console.log(`    State Admins    : ${finalState}`);
console.log(`    District Admins : ${finalDistrict}`);
console.log(`    Group Admins    : ${finalGroup}`);
if (DRY_RUN) {
  console.log('\n  ⚡ This was a DRY RUN. Re-run with --execute to apply changes.');
}
console.log('========================================================\n');

await mongoose.disconnect();
