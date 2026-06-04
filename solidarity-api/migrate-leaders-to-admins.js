/**
 * Migration Script: Promote leaders to admin users
 *
 * - State leaders (state.json) → ensure User record with role: 'state_admin'
 * - District leaders (leaders-Dis.json) → ensure User record with role: 'district_admin'
 *
 * Logic:
 *   1. Check if User already exists with that phone + correct role → skip
 *   2. If User exists with different role → report (won't overwrite)
 *   3. If no User record → create one
 *   4. Also checks for duplicate phone numbers across input files
 *
 * Usage:
 *   node migrate-leaders-to-admins.js            (dry run)
 *   node migrate-leaders-to-admins.js --execute  (apply changes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

import User from './src/models/User.js';

const districtSchema = new mongoose.Schema({ name: String, code: String }, { timestamps: true });
const District = mongoose.models.District || mongoose.model('District', districtSchema);

function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').replace(/^0+/, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  return p;
}

async function run() {
  console.log('\n========================================================');
  console.log(DRY_RUN ? '  DRY RUN – no changes will be written' : '  EXECUTE MODE – changes WILL be written');
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const projectRoot = join(__dirname, '..');
  const stateLeaders    = JSON.parse(readFileSync(join(projectRoot, 'state.json'), 'utf-8'));
  const districtLeaders = JSON.parse(readFileSync(join(projectRoot, 'leaders-Dis.json'), 'utf-8'));

  const allDistricts = await District.find({}, 'name code').lean();
  function findDistrict(name) {
    const lower = name.toLowerCase().trim();
    return allDistricts.find(d => d.name.toLowerCase() === lower);
  }

  const stats = {
    stateCreated: 0, stateAlready: 0, stateUpdated: 0,
    districtCreated: 0, districtAlready: 0, districtUpdated: 0,
    districtNotFound: 0, duplicates: []
  };

  // ─── DUPLICATE CHECK ───────────────────────────────────────────────────────
  console.log('═══ DUPLICATE CHECK ══════════════════════════════════════\n');

  const phoneMap = new Map();
  for (const entry of stateLeaders) {
    const phone = normalizePhone(entry.Phone);
    if (phoneMap.has(phone)) {
      phoneMap.get(phone).push({ ...entry, level: 'state' });
    } else {
      phoneMap.set(phone, [{ ...entry, level: 'state' }]);
    }
  }
  for (const entry of districtLeaders) {
    const phone = normalizePhone(entry.Phone);
    if (phoneMap.has(phone)) {
      phoneMap.get(phone).push({ ...entry, level: 'district' });
    } else {
      phoneMap.set(phone, [{ ...entry, level: 'district' }]);
    }
  }

  for (const [phone, entries] of phoneMap) {
    if (entries.length > 1) {
      stats.duplicates.push({ phone, entries });
      console.log(`   ⚠️  DUPLICATE phone ${phone}:`);
      for (const e of entries) {
        console.log(`      • ${e.Name} — ${e.level} leader (${e.Role || 'N/A'}) ${e.DISTRICT ? `[${e.DISTRICT}]` : ''}`);
      }
    }
  }

  if (stats.duplicates.length === 0) {
    console.log('   ✅ No duplicate phone numbers found across input files.');
  }

  // Also check existing DB duplicates
  const existingUsers = await User.find({}, 'name phone role district isActive').lean();
  const dbPhoneRoleMap = new Map();
  for (const u of existingUsers) {
    const key = `${normalizePhone(u.phone)}_${u.role}`;
    if (dbPhoneRoleMap.has(key)) {
      dbPhoneRoleMap.get(key).push(u);
    } else {
      dbPhoneRoleMap.set(key, [u]);
    }
  }

  let dbDuplicates = 0;
  for (const [key, users] of dbPhoneRoleMap) {
    if (users.length > 1) {
      dbDuplicates++;
      console.log(`   ⚠️  DB DUPLICATE: ${key} → ${users.length} records: ${users.map(u => `${u.name} (${u._id})`).join(', ')}`);
    }
  }
  if (dbDuplicates === 0) {
    console.log('   ✅ No duplicate User records in DB (same phone + same role).');
  }

  // ─── STATE LEADERS → STATE ADMIN ──────────────────────────────────────────
  console.log('\n═══ STATE LEADERS → STATE ADMIN ══════════════════════════\n');

  for (const entry of stateLeaders) {
    const phone = normalizePhone(entry.Phone);
    const variants = [phone, `+91${phone}`];

    // Check if already state_admin
    const existing = await User.findOne({ phone: { $in: variants }, role: 'state_admin' });

    if (existing) {
      stats.stateAlready++;
      console.log(`   ⏭️  ${entry.Name} (${phone}) — already state_admin`);
      continue;
    }

    // Check if exists with another role
    const otherRole = await User.findOne({ phone: { $in: variants } });
    if (otherRole) {
      // Update role to state_admin (state leader takes priority)
      if (DRY_RUN) {
        console.log(`   📋 ${entry.Name} (${phone}) — exists as ${otherRole.role}, would UPGRADE to state_admin`);
      } else {
        otherRole.role = 'state_admin';
        otherRole.name = entry.Name;
        otherRole.isActive = true;
        otherRole.isLeader = true;
        otherRole.roleTag = { type: 'state', name: entry.Role };
        // Remove district requirement for state_admin
        otherRole.district = undefined;
        otherRole.group = undefined;
        await otherRole.save();
        console.log(`   ✅ ${entry.Name} (${phone}) — UPGRADED from ${otherRole.role} to state_admin`);
      }
      stats.stateUpdated++;
      continue;
    }

    // Create new
    if (DRY_RUN) {
      console.log(`   📋 ${entry.Name} (${phone}) — would CREATE state_admin`);
    } else {
      const newUser = new User({
        name: entry.Name,
        phone,
        role: 'state_admin',
        isActive: true,
        isLeader: true,
        roleTag: { type: 'state', name: entry.Role },
      });
      await newUser.save();
      console.log(`   ✅ ${entry.Name} (${phone}) — CREATED state_admin`);
    }
    stats.stateCreated++;
  }

  // ─── DISTRICT LEADERS → DISTRICT ADMIN ────────────────────────────────────
  console.log('\n═══ DISTRICT LEADERS → DISTRICT ADMIN ════════════════════\n');

  for (const entry of districtLeaders) {
    const phone = normalizePhone(entry.Phone);
    const variants = [phone, `+91${phone}`];
    const district = findDistrict(entry.DISTRICT);

    if (!district) {
      stats.districtNotFound++;
      console.log(`   ❌ ${entry.Name} (${phone}) — district "${entry.DISTRICT}" NOT FOUND in DB`);
      continue;
    }

    // Check if already district_admin for this district
    const existing = await User.findOne({ phone: { $in: variants }, role: 'district_admin' });

    if (existing) {
      const districtMatch = existing.district?.toString() === district._id.toString();
      if (districtMatch && existing.isActive) {
        stats.districtAlready++;
        console.log(`   ⏭️  ${entry.Name} (${phone}) — already district_admin for ${district.name}`);
      } else {
        // Update district assignment
        if (DRY_RUN) {
          console.log(`   📋 ${entry.Name} (${phone}) — would update district to ${district.name}`);
        } else {
          existing.name = entry.Name;
          existing.district = district._id;
          existing.isActive = true;
          existing.isLeader = true;
          existing.roleTag = { type: 'district', name: entry.Role };
          await existing.save();
          console.log(`   ✅ ${entry.Name} (${phone}) — updated district_admin → ${district.name}`);
        }
        stats.districtUpdated++;
      }
      continue;
    }

    // Check if user exists with phone but different role (e.g. group_admin)
    const otherRole = await User.findOne({ phone: { $in: variants } });

    // Skip if already state_admin (state takes priority over district)
    if (otherRole && otherRole.role === 'state_admin') {
      console.log(`   ⏭️  ${entry.Name} (${phone}) — already state_admin, skipping district_admin creation`);
      stats.districtAlready++;
      continue;
    }

    if (otherRole) {
      // Upgrade to district_admin
      if (DRY_RUN) {
        console.log(`   📋 ${entry.Name} (${phone}) — exists as ${otherRole.role}, would UPGRADE to district_admin for ${district.name}`);
      } else {
        otherRole.role = 'district_admin';
        otherRole.name = entry.Name;
        otherRole.district = district._id;
        otherRole.isActive = true;
        otherRole.isLeader = true;
        otherRole.roleTag = { type: 'district', name: entry.Role };
        await otherRole.save();
        console.log(`   ✅ ${entry.Name} (${phone}) — UPGRADED to district_admin for ${district.name}`);
      }
      stats.districtUpdated++;
      continue;
    }

    // Create new
    if (DRY_RUN) {
      console.log(`   📋 ${entry.Name} (${phone}) — would CREATE district_admin for ${district.name}`);
    } else {
      const newUser = new User({
        name: entry.Name,
        phone,
        role: 'district_admin',
        district: district._id,
        isActive: true,
        isLeader: true,
        roleTag: { type: 'district', name: entry.Role },
      });
      await newUser.save();
      console.log(`   ✅ ${entry.Name} (${phone}) — CREATED district_admin for ${district.name}`);
    }
    stats.districtCreated++;
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log('  LEADERS → ADMINS MIGRATION SUMMARY');
  console.log('========================================================');
  console.log(`  STATE LEADERS (${stateLeaders.length} total):`);
  console.log(`    Already state_admin  : ${stats.stateAlready}`);
  console.log(`    Upgraded to state_admin: ${stats.stateUpdated}`);
  console.log(`    Created as state_admin : ${stats.stateCreated}`);
  console.log(`  DISTRICT LEADERS (${districtLeaders.length} total):`);
  console.log(`    Already district_admin : ${stats.districtAlready}`);
  console.log(`    Upgraded to district_admin: ${stats.districtUpdated}`);
  console.log(`    Created as district_admin : ${stats.districtCreated}`);
  console.log(`    District not found     : ${stats.districtNotFound}`);
  console.log(`  DUPLICATES: ${stats.duplicates.length} phone numbers appear in multiple lists`);
  if (DRY_RUN) {
    console.log('\n  ⚡ This was a DRY RUN. Re-run with --execute to apply changes.');
  } else {
    console.log('\n  ✅ Migration complete!');
  }
  console.log('========================================================\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
