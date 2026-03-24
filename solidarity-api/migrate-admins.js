/**
 * Migration Script: Create state admin and district admin User records
 *
 * Sources:
 *   - admins-st.json   → state admins    (role: state_admin)
 *   - admin-dis.json   → district admins (role: district_admin, with district assignment)
 *
 * Logic:
 *   For each entry, check if a User with that phone + role already exists.
 *     If yes → update name/district as needed.
 *     If no  → create a new User (permissions auto-set via pre-save hook).
 *
 * Usage:
 *   node migrate-admins.js            (dry run)
 *   node migrate-admins.js --execute  (apply changes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

// ─── Import the real User model so pre-save hooks fire ────────────────────────
import User from './src/models/User.js';

// Lightweight schemas for District lookup
const districtSchema = new mongoose.Schema({ name: String, code: String }, { timestamps: true });
const District = mongoose.models.District || mongoose.model('District', districtSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').replace(/^0+/, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  return p; // 10-digit
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n========================================================');
  console.log(DRY_RUN ? '  DRY RUN – no changes will be written' : '  EXECUTE MODE – changes WILL be written');
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const projectRoot = join(__dirname, '..');
  const stateAdmins    = JSON.parse(readFileSync(join(projectRoot, 'admins-st.json'), 'utf-8'));
  const districtAdmins = JSON.parse(readFileSync(join(projectRoot, 'admin-dis.json'), 'utf-8'));

  // Load all districts for name matching
  const allDistricts = await District.find({}, 'name code').lean();
  console.log(`📋 Districts in DB: ${allDistricts.map(d => d.name).join(', ')}\n`);

  // Build case-insensitive lookup
  function findDistrict(name) {
    const lower = name.toLowerCase().trim();
    return allDistricts.find(d => d.name.toLowerCase() === lower);
  }

  const stats = { created: 0, updated: 0, alreadyCorrect: 0, districtNotFound: 0 };
  const errors = [];

  // ─── Process State Admins ──────────────────────────────────────────────────
  console.log('═══ STATE ADMINS ═════════════════════════════════════════\n');

  for (const entry of stateAdmins) {
    const phone = normalizePhone(entry.Phone);
    const existing = await User.findOne({ phone, role: 'state_admin' });

    if (existing) {
      if (existing.name === entry.Name && existing.isActive) {
        stats.alreadyCorrect++;
        console.log(`   ⏭️  ${entry.Name} (${phone}) — already state_admin`);
      } else {
        if (DRY_RUN) {
          console.log(`   📋 ${entry.Name} (${phone}) — would update existing state_admin`);
        } else {
          existing.name = entry.Name;
          existing.isActive = true;
          await existing.save();
          console.log(`   ✅ ${entry.Name} (${phone}) — updated existing state_admin`);
        }
        stats.updated++;
      }
    } else {
      // Check if exists with different role
      const otherRole = await User.findOne({ phone });
      if (otherRole) {
        console.log(`   ℹ️  ${entry.Name} (${phone}) — exists as ${otherRole.role}, will create additional state_admin record`);
      }

      if (DRY_RUN) {
        console.log(`   📋 ${entry.Name} (${phone}) — would create state_admin`);
      } else {
        const newUser = new User({
          name: entry.Name,
          phone,
          role: 'state_admin',
          isActive: true,
        });
        await newUser.save(); // triggers pre-save → sets permissions
        console.log(`   ✅ ${entry.Name} (${phone}) — created state_admin (permissions auto-set)`);
      }
      stats.created++;
    }
  }

  // ─── Process District Admins ───────────────────────────────────────────────
  console.log('\n═══ DISTRICT ADMINS ══════════════════════════════════════\n');

  for (const entry of districtAdmins) {
    const phone = normalizePhone(entry.Phone);
    const district = findDistrict(entry.DISTRICT);

    if (!district) {
      stats.districtNotFound++;
      errors.push(`${entry.Name} (${phone}) — district "${entry.DISTRICT}" not found in DB`);
      console.log(`   ❌ ${entry.Name} (${phone}) — district "${entry.DISTRICT}" NOT FOUND`);
      continue;
    }

    const existing = await User.findOne({ phone, role: 'district_admin' });

    if (existing) {
      const districtMatch = existing.district?.toString() === district._id.toString();
      if (districtMatch && existing.isActive) {
        stats.alreadyCorrect++;
        console.log(`   ⏭️  ${entry.Name} (${phone}) — already district_admin for ${district.name}`);
      } else {
        if (DRY_RUN) {
          console.log(`   📋 ${entry.Name} (${phone}) — would update: district → ${district.name}`);
        } else {
          existing.name = entry.Name;
          existing.district = district._id;
          existing.isActive = true;
          await existing.save();
          console.log(`   ✅ ${entry.Name} (${phone}) — updated district_admin → ${district.name}`);
        }
        stats.updated++;
      }
    } else {
      if (DRY_RUN) {
        console.log(`   📋 ${entry.Name} (${phone}) — would create district_admin for ${district.name}`);
      } else {
        const newUser = new User({
          name: entry.Name,
          phone,
          role: 'district_admin',
          district: district._id,
          isActive: true,
        });
        await newUser.save();
        console.log(`   ✅ ${entry.Name} (${phone}) — created district_admin for ${district.name}`);
      }
      stats.created++;
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log('  ADMIN MIGRATION SUMMARY');
  console.log('========================================================');
  console.log(`  Created              : ${stats.created}`);
  console.log(`  Updated              : ${stats.updated}`);
  console.log(`  Already correct      : ${stats.alreadyCorrect}`);
  console.log(`  District not found   : ${stats.districtNotFound}`);
  if (errors.length > 0) {
    console.log(`\n  ❌ ERRORS:`);
    errors.forEach(e => console.log(`     • ${e}`));
  }
  if (DRY_RUN) {
    console.log('\n  ⚡ This was a DRY RUN. Re-run with --execute to apply changes.');
  } else {
    console.log('\n  ✅ Admin migration complete!');
    console.log('  ℹ️  Users can now log in with their phone number via OTP.');
  }
  console.log('========================================================\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
