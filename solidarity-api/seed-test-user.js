/**
 * Seed the shared test login: 9876543210, code 1234.
 *
 * Creates one real account per role so a single number can exercise the whole app
 * and the login account-picker has something with more than one entry to show:
 *
 *   State Admin · District Admin · Area Admin · Murabi Admin · Coordinator Admin · Member
 *
 * These are ordinary rows — they carry a real district/group, so scoped pages
 * (members lists, reports, targets) return real data instead of coming up empty.
 * The only special-casing lives in loginService: this number skips the WhatsApp
 * send and always accepts 1234.
 *
 * Also doubles as a throwaway multi-role account maker for a real number, so WhatsApp
 * delivery and the account picker can be exercised end to end. A custom number gets
 * admin accounts only (no Member row is invented for a real person) and no OTP
 * shortcut — it receives a genuine code over WhatsApp.
 *
 * Usage:
 *   node seed-test-user.js            (dry run)
 *   node seed-test-user.js --execute  (apply)
 *   node seed-test-user.js --remove --execute   (delete the seeded accounts)
 *
 *   node seed-test-user.js --phone=9995707129 --name="Muhammed Ilyas" --execute
 *   node seed-test-user.js --phone=9995707129 --remove --execute
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import User from './src/models/User.js';
import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import Group from './src/models/Group.js';
// Imported for its side effect: resolveScope() populates Group.district, and mongoose
// throws MissingSchemaError unless the District model has been registered first.
import './src/models/District.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const EXECUTE = process.argv.includes('--execute');
const REMOVE = process.argv.includes('--remove');

const argValue = (flag) => {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1).replace(/^["']|["']$/g, '') : null;
};

const DEFAULT_PHONE = '9876543210';
const PHONE = (argValue('--phone') || DEFAULT_PHONE).replace(/\D/g, '').slice(-10);
const PHONE_E164 = `+91${PHONE}`;         // members are stored with the +91 prefix, admins bare
const CUSTOM_NAME = argValue('--name');
const IS_DEFAULT_PHONE = PHONE === DEFAULT_PHONE;

if (!/^[6-9]\d{9}$/.test(PHONE)) {
  console.error(`\n"${PHONE}" is not a valid 10-digit Indian mobile number.\n`);
  process.exit(1);
}

// A real person keeps one name across their accounts; the synthetic fixture gets a
// per-role name so the seeded rows are obvious in the admin lists.
const named = (roleName) => CUSTOM_NAME || `Test ${roleName}`;

const ADMIN_ACCOUNTS = [
  { label: 'State Admin', role: 'state_admin', adminKind: 'area', needs: 'none' },
  { label: 'District Admin', role: 'district_admin', adminKind: 'area', needs: 'district' },
  { label: 'Area Admin', role: 'group_admin', adminKind: 'area', needs: 'group' },
  { label: 'Murabi Admin', role: 'group_admin', adminKind: 'murabi', needs: 'group' },
  { label: 'Coordinator Admin', role: 'group_admin', adminKind: 'coordinator', needs: 'group' },
].map((spec) => ({ ...spec, name: named(spec.label) }));

const log = (...args) => console.log(...args);

async function resolveScope() {
  const group = await Group.findOne().populate('district', 'name').lean();
  if (!group) {
    throw new Error('No groups exist yet — seed districts and groups before the test user.');
  }
  if (!group.district) {
    throw new Error(`Group "${group.name}" has no district; cannot scope the test accounts.`);
  }
  return { groupId: group._id, districtId: group.district._id, label: `${group.district.name} • ${group.name}` };
}

async function removeSeed() {
  const users = await User.find({ phone: PHONE }).select('role adminKind').lean();
  const member = await Member.findOne({ phone: { $in: [PHONE, PHONE_E164] } }).select('_id').lean();

  log(`  · ${users.length} admin account(s) and ${member ? 1 : 0} member account to remove`);

  if (!EXECUTE) {
    log('  · dry run — nothing deleted');
    return;
  }

  await User.deleteMany({ phone: PHONE });
  if (member) {
    await MemberAuth.deleteMany({ member: member._id });
    await Member.deleteOne({ _id: member._id });
  }
  log('  ✓ removed');
}

async function seedAdmins(scope) {
  const created = [];

  for (const spec of ADMIN_ACCOUNTS) {
    const existing = await User.findOne({ phone: PHONE, role: spec.role, adminKind: spec.adminKind });

    if (existing) {
      log(`  · ${spec.label} (${spec.name}) already exists`);
      created.push(existing);
      continue;
    }

    if (!EXECUTE) {
      log(`  · would create ${spec.label} — ${spec.name}`);
      continue;
    }

    const doc = await User.create({
      name: spec.name,
      phone: PHONE,
      role: spec.role,
      adminKind: spec.adminKind,
      isActive: true,
      // Area-level gating reads roleTag.type for 'area' admins (adminKind alone is
      // deliberately not sufficient — legacy unit admins also carry adminKind 'area').
      ...(spec.role === 'group_admin' ? { roleTag: { type: spec.adminKind, name: spec.name } } : {}),
      ...(spec.needs === 'district' ? { district: scope.districtId } : {}),
      ...(spec.needs === 'group' ? { district: scope.districtId, group: scope.groupId } : {}),
    });
    log(`  ✓ created ${spec.label} — ${spec.name}`);
    created.push(doc);
  }

  return created;
}

async function seedMember(scope, createdBy) {
  const existing = await Member.findOne({ phone: { $in: [PHONE, PHONE_E164] } });

  if (existing) {
    log('  · Test Member already exists');
    if (EXECUTE) {
      await MemberAuth.createForMember(existing._id);
    }
    return;
  }

  if (!EXECUTE) {
    log('  · would create Test Member (+ MemberAuth)');
    return;
  }

  if (!createdBy) {
    log('  ! skipped Test Member — no seeded admin available for the required createdBy field');
    return;
  }

  const member = await Member.create({
    name: 'Test Member',
    phone: PHONE_E164,
    district: scope.districtId,
    group: scope.groupId,
    status: 'Active',
    isApproved: true,
    createdBy,
  });

  await MemberAuth.createForMember(member._id);
  log('  ✓ created Test Member (+ MemberAuth)');
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set — check solidarity-api/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  log(`\nTest user ${PHONE} — ${REMOVE ? 'REMOVE' : 'SEED'} — ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  if (REMOVE) {
    await removeSeed();
  } else {
    const scope = await resolveScope();
    log(`Scope: ${scope.label}\n`);

    log('1. Admin accounts');
    const admins = await seedAdmins(scope);

    // Only the synthetic fixture gets a Member row — inventing a membership record
    // for a real person would put fake data in the members directory.
    if (IS_DEFAULT_PHONE) {
      log('\n2. Member account');
      await seedMember(scope, admins[0]?._id);
    } else {
      log('\n2. Member account\n  · skipped — admin accounts only for a real number');
    }

    if (!EXECUTE) {
      log('\nDry run complete. Re-run with --execute to apply.\n');
    } else if (IS_DEFAULT_PHONE) {
      log(`\nDone. Sign in with ${PHONE} and code 1234 — the picker lists all 6 accounts.\n`);
    } else {
      log(`\nDone. Sign in with ${PHONE} — a real code will be sent over WhatsApp.`);
      log(`Remove later with: node seed-test-user.js --phone=${PHONE} --remove --execute\n`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\nSeed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
