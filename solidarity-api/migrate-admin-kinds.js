/**
 * Migration: introduce User.adminKind (area | murabi | coordinator).
 *
 * Murabi Admin and Coordinator Admin have the same permissions as Area Admin, so
 * they are stored as role: 'group_admin' with a different adminKind rather than as
 * new role enum values. This script:
 *
 *   1. Drops the stale { phone, role } unique index — the key is now
 *      { phone, role, adminKind }, so one number can hold both an Area Admin and a
 *      Murabi Admin account.
 *   2. Backfills adminKind: 'area' on every existing user.
 *   3. Retags group_admin users whose roleTag.type is already 'murabi'/'coordinator'.
 *   4. Creates an extra group_admin account for anyone carrying a murabi/coordinator
 *      entry in extraRoleTags, so those leaders get a real login of that kind.
 *
 * Usage:
 *   node migrate-admin-kinds.js            (dry run — reports, changes nothing)
 *   node migrate-admin-kinds.js --execute  (apply)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import User from './src/models/User.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const EXECUTE = process.argv.includes('--execute');
const KINDS = ['murabi', 'coordinator'];

const log = (...args) => console.log(...args);

async function dropLegacyIndex() {
  const indexes = await User.collection.indexes();
  const legacy = indexes.find((i) => i.name === 'phone_1_role_1');

  if (!legacy) {
    log('  · legacy phone_1_role_1 index already gone');
    return;
  }

  if (!EXECUTE) {
    log('  · would drop legacy unique index phone_1_role_1');
    return;
  }

  await User.collection.dropIndex('phone_1_role_1');
  log('  ✓ dropped legacy unique index phone_1_role_1');
}

async function backfillDefaultKind() {
  const filter = { adminKind: { $exists: false } };
  const count = await User.countDocuments(filter);

  if (count === 0) {
    log('  · every user already has adminKind');
    return;
  }

  if (!EXECUTE) {
    log(`  · would set adminKind='area' on ${count} user(s)`);
    return;
  }

  const result = await User.updateMany(filter, { $set: { adminKind: 'area' } });
  log(`  ✓ set adminKind='area' on ${result.modifiedCount} user(s)`);
}

async function retagExistingAreaAdmins() {
  const users = await User.find({
    role: 'group_admin',
    'roleTag.type': { $in: KINDS },
  }).select('name phone roleTag adminKind');

  if (users.length === 0) {
    log('  · no group_admin users tagged murabi/coordinator');
    return;
  }

  for (const user of users) {
    const kind = user.roleTag.type;
    if (user.adminKind === kind) continue;

    if (!EXECUTE) {
      log(`  · would retag ${user.name} (${user.phone}) → ${kind}`);
      continue;
    }

    user.adminKind = kind;
    await user.save({ validateModifiedOnly: true });
    log(`  ✓ retagged ${user.name} (${user.phone}) → ${kind}`);
  }
}

async function createAccountsFromExtraRoleTags() {
  const users = await User.find({ 'extraRoleTags.type': { $in: KINDS } })
    .select('name phone email district group extraRoleTags')
    .lean();

  if (users.length === 0) {
    log('  · no users carry murabi/coordinator in extraRoleTags');
    return;
  }

  for (const user of users) {
    const kinds = [...new Set(user.extraRoleTags.filter((t) => KINDS.includes(t.type)).map((t) => t.type))];

    for (const kind of kinds) {
      const existing = await User.findOne({ phone: user.phone, role: 'group_admin', adminKind: kind });
      if (existing) {
        log(`  · ${user.name} (${user.phone}) already has a ${kind} account`);
        continue;
      }

      // group is required for group_admin — skip anyone we cannot scope.
      if (!user.group) {
        log(`  ! skipped ${user.name} (${user.phone}) — no group to scope a ${kind} account to`);
        continue;
      }

      if (!EXECUTE) {
        log(`  · would create ${kind} account for ${user.name} (${user.phone})`);
        continue;
      }

      await User.create({
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: 'group_admin',
        adminKind: kind,
        district: user.district,
        group: user.group,
        roleTag: { type: kind, name: user.name },
        isActive: true,
      });
      log(`  ✓ created ${kind} account for ${user.name} (${user.phone})`);
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — check solidarity-api/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  log(`\nadminKind migration — ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  log('1. Indexes');
  await dropLegacyIndex();

  log('\n2. Backfill default kind');
  await backfillDefaultKind();

  log('\n3. Retag existing area admins');
  await retagExistingAreaAdmins();

  log('\n4. Accounts from extraRoleTags');
  await createAccountsFromExtraRoleTags();

  if (EXECUTE) {
    await User.syncIndexes();
    log('\n  ✓ synced indexes to the current schema');
  }

  log(EXECUTE ? '\nDone.\n' : '\nDry run complete. Re-run with --execute to apply.\n');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\nMigration failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
