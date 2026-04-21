/**
 * Migration Script: Import new members as admin-approved and dashboard-ready
 *
 * Source:
 *   - new members.json
 *
 * Behavior:
 *   - Reads members from JSON.
 *   - Resolves district and group from District/Group collections.
 *   - Creates member records (or updates existing by phone variants).
 *   - Ensures members are admin-approved and Active.
 *   - Ensures MemberAuth exists and isActive=true for dashboard login.
 *   - Updates impacted Group/District statistics.
 *
 * Usage:
 *   node migrate-new-members.js            (dry run)
 *   node migrate-new-members.js --execute  (apply changes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import User from './src/models/User.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDistrictName(name) {
  const key = normalizeText(name);
  const aliasMap = {
    ernakulam: 'ernakulam',
    malappurameast: 'malappurameast',
    malappuramwest: 'malappuramwest',
    kozhikode: 'kozhikode',
    idukki: 'idukki',
    thrissur: 'thrissur',
    thiruvananthapuram: 'thiruvananthapuram',
    kannur: 'kannur',
    kollam: 'kollam',
  };

  return aliasMap[key] || key;
}

function normalizeGroupName(name) {
  const key = normalizeText(name);
  const aliasMap = {
    adimaly: 'adimali',
    kalamashery: 'kalamassery',
    valluvambram: 'velluvambram',
    tirurangadi: 'thirurangadi',
    tirur: 'thirur',
    areacode: 'areekode',
  };

  return aliasMap[key] || key;
}

function parsePhone(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;

  let tenDigit = digits;
  if (tenDigit.length === 12 && tenDigit.startsWith('91')) {
    tenDigit = tenDigit.slice(2);
  }
  if (tenDigit.length === 11 && tenDigit.startsWith('0')) {
    tenDigit = tenDigit.slice(1);
  }

  if (tenDigit.length !== 10) return null;
  return `+91${tenDigit}`;
}

function phoneVariants(phone) {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return [phone];
  return [digits, `91${digits}`, `+91${digits}`];
}

function parseDate(dateString) {
  if (!dateString) return undefined;
  const raw = String(dateString).trim();
  if (!raw) return undefined;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const parts = raw.split('/').map(p => parseInt(p, 10));
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [month, day, year] = parts;
    const fallback = new Date(year, month - 1, day);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }

  return undefined;
}

async function findApproverAdmin() {
  const approver = await User.findOne({ role: 'state_admin', isActive: true }).sort({ createdAt: 1 });
  if (approver) return approver;

  return User.findOne({ role: { $in: ['district_admin', 'group_admin'] }, isActive: true }).sort({ createdAt: 1 });
}

async function buildDistrictMap() {
  const districts = await District.find({}, 'name').lean();
  const map = new Map();
  for (const district of districts) {
    map.set(normalizeDistrictName(district.name), district);
  }
  return map;
}

async function buildGroupMap() {
  const groups = await Group.find({}, 'name district').lean();
  const map = new Map();

  for (const group of groups) {
    if (!group.district) continue;
    const districtId = String(group.district);
    if (!map.has(districtId)) {
      map.set(districtId, []);
    }

    map.get(districtId).push({
      _id: group._id,
      name: group.name,
      normalizedName: normalizeGroupName(group.name),
    });
  }

  return map;
}

function resolveGroup(groupCandidates, areaName) {
  if (!groupCandidates || groupCandidates.length === 0) return null;
  const normalizedArea = normalizeGroupName(areaName);
  if (!normalizedArea) return null;

  const exact = groupCandidates.find(g => g.normalizedName === normalizedArea);
  if (exact) return exact;

  const contains = groupCandidates.find(
    g => g.normalizedName.includes(normalizedArea) || normalizedArea.includes(g.normalizedName)
  );
  return contains || null;
}

async function upsertMemberAuth(memberId, phone, shouldActivate) {
  let auth = await MemberAuth.findOne({ member: memberId });
  if (!auth) {
    auth = new MemberAuth({
      member: memberId,
      phone,
      isActive: shouldActivate,
    });
    await auth.save();
    return { created: true, updated: false };
  }

  let changed = false;
  if (auth.phone !== phone) {
    auth.phone = phone;
    changed = true;
  }
  if (auth.isActive !== shouldActivate) {
    auth.isActive = shouldActivate;
    changed = true;
  }

  if (changed) {
    await auth.save();
    return { created: false, updated: true };
  }

  return { created: false, updated: false };
}

async function run() {
  console.log('\n========================================================');
  console.log(DRY_RUN ? '  DRY RUN - no changes will be written' : '  EXECUTE MODE - changes WILL be written');
  console.log('========================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const approver = await findApproverAdmin();
  if (!approver) {
    throw new Error('No active admin user found. At least one active state/district/group admin is required.');
  }

  const inputPath = join(__dirname, 'new members.json');
  const entries = JSON.parse(readFileSync(inputPath, 'utf-8'));

  const districtMap = await buildDistrictMap();
  const groupMap = await buildGroupMap();

  const stats = {
    total: entries.length,
    createdMembers: 0,
    updatedMembers: 0,
    unchangedMembers: 0,
    authCreated: 0,
    authUpdated: 0,
    errors: 0,
    skippedMissingPhone: 0,
    skippedDistrictNotFound: 0,
    skippedGroupNotFound: 0,
  };

  const failures = [];
  const touchedDistricts = new Set();
  const touchedGroups = new Set();

  for (const row of entries) {
    const name = String(row.Name || '').trim();
    const districtName = String(row.District || '').trim();
    const areaName = String(row.Area || '').trim();
    const phone = parsePhone(row.MOBILE);
    const dateOfBirth = parseDate(row['Date of Birth']);

    if (!phone) {
      stats.skippedMissingPhone++;
      failures.push(`${name || '(no name)'} - invalid/missing phone`);
      console.log(`SKIP  ${name || '(no name)'} - invalid/missing phone`);
      continue;
    }

    const district = districtMap.get(normalizeDistrictName(districtName));
    if (!district) {
      stats.skippedDistrictNotFound++;
      failures.push(`${name} (${phone}) - district not found: "${districtName}"`);
      console.log(`SKIP  ${name} (${phone}) - district not found: ${districtName}`);
      continue;
    }

    const districtGroups = groupMap.get(String(district._id)) || [];
    const group = resolveGroup(districtGroups, areaName);
    if (!group) {
      stats.skippedGroupNotFound++;
      failures.push(`${name} (${phone}) - group not found in ${district.name}: "${areaName}"`);
      console.log(`SKIP  ${name} (${phone}) - group not found in ${district.name}: ${areaName}`);
      continue;
    }

    const existing = await Member.findOne({ phone: { $in: phoneVariants(phone) } });

    const memberPatch = {
      name,
      phone,
      dateOfBirth,
      district: district._id,
      group: group._id,
      status: 'Active',
      isApproved: true,
      approvedBy: approver._id,
      approvedAt: new Date(),
      updatedBy: approver._id,
    };

    if (!existing) {
      if (DRY_RUN) {
        console.log(`CREATE ${name} (${phone}) -> ${district.name} / ${group.name} [approved + active]`);
      } else {
        const member = new Member({
          ...memberPatch,
          createdBy: approver._id,
        });
        await member.save();

        const authResult = await upsertMemberAuth(member._id, phone, true);
        if (authResult.created) stats.authCreated++;
        if (authResult.updated) stats.authUpdated++;
      }

      stats.createdMembers++;
      touchedDistricts.add(String(district._id));
      touchedGroups.add(String(group._id));
      continue;
    }

    let changed = false;
    for (const [key, value] of Object.entries(memberPatch)) {
      const existingValue = existing[key];

      if (value === undefined) continue;

      if (existingValue instanceof Date && value instanceof Date) {
        if (existingValue.getTime() !== value.getTime()) {
          existing[key] = value;
          changed = true;
        }
        continue;
      }

      if (String(existingValue || '') !== String(value || '')) {
        existing[key] = value;
        changed = true;
      }
    }

    if (DRY_RUN) {
      console.log(`${changed ? 'UPDATE' : 'OK   '} ${name} (${phone}) -> ${district.name} / ${group.name}`);
    } else {
      if (changed) {
        await existing.save();
      }

      const authResult = await upsertMemberAuth(existing._id, phone, true);
      if (authResult.created) stats.authCreated++;
      if (authResult.updated) stats.authUpdated++;
    }

    if (changed) {
      stats.updatedMembers++;
      touchedDistricts.add(String(district._id));
      touchedGroups.add(String(group._id));
    } else {
      stats.unchangedMembers++;
    }
  }

  if (!DRY_RUN) {
    for (const districtId of touchedDistricts) {
      const district = await District.findById(districtId);
      if (district) await district.updateStatistics();
    }

    for (const groupId of touchedGroups) {
      const group = await Group.findById(groupId);
      if (group) await group.updateStatistics();
    }
  }

  stats.errors = failures.length;

  console.log('\n========================================================');
  console.log('  NEW MEMBER MIGRATION SUMMARY');
  console.log('========================================================');
  console.log(`  Total JSON rows           : ${stats.total}`);
  console.log(`  Members created           : ${stats.createdMembers}`);
  console.log(`  Members updated           : ${stats.updatedMembers}`);
  console.log(`  Members unchanged         : ${stats.unchangedMembers}`);
  console.log(`  MemberAuth created        : ${stats.authCreated}`);
  console.log(`  MemberAuth updated        : ${stats.authUpdated}`);
  console.log(`  Skipped (missing phone)   : ${stats.skippedMissingPhone}`);
  console.log(`  Skipped (district missing): ${stats.skippedDistrictNotFound}`);
  console.log(`  Skipped (group missing)   : ${stats.skippedGroupNotFound}`);
  console.log(`  Errors/Warnings           : ${stats.errors}`);

  if (failures.length > 0) {
    console.log('\n  DETAILS:');
    for (const item of failures) {
      console.log(`   - ${item}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n  Dry run complete. Re-run with --execute to apply changes.');
  } else {
    console.log('\n  Migration complete. Imported members are approved and login-ready.');
  }

  console.log('========================================================\n');

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});
