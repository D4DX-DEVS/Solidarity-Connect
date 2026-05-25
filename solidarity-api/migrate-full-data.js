/**
 * Full Data Migration Script: Replace ALL districts, groups, and members
 * from a new Excel file.
 *
 * Steps:
 *   1. Read and parse the Excel file
 *   2. Extract unique districts and areas (groups)
 *   3. Remove ALL existing members, groups, districts, and related auth
 *   4. Create districts from Excel
 *   5. Create areas (groups) linked to districts
 *   6. Create members linked to their district and group
 *   7. Report successes and failures
 *
 * Usage:
 *   node migrate-full-data.js                        (dry run - no changes)
 *   node migrate-full-data.js --execute              (apply changes)
 *   node migrate-full-data.js --execute --file path  (custom Excel path)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import User from './src/models/User.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');
const fileArgIndex = process.argv.indexOf('--file');
const EXCEL_PATH = fileArgIndex !== -1 && process.argv[fileArgIndex + 1]
  ? process.argv[fileArgIndex + 1]
  : join(__dirname, 'migration-data.xlsx');

// ─── Status mapping from Excel to DB ───────────────────────────────────────────
const STATUS_MAP = {
  'AVAILABLE IN AREA/DISTRICT': 'Active',
  'ABROAD': 'Abroad',
  'OUT OF DISTRICT': 'Active',
  'OUT OF STATE': 'Active',
  'OUT OF COUNTRY': 'Abroad',
};

// ─── Blood group normalization ─────────────────────────────────────────────────
function normalizeBloodGroup(raw) {
  if (!raw) return undefined;
  const cleaned = raw.trim().toUpperCase()
    .replace(/\s+/g, '')
    .replace('POSITIVE', '+')
    .replace('NEGATIVE', '-')
    .replace('VE', '');
  
  const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (validGroups.includes(cleaned)) return cleaned;
  
  // Try to extract
  const match = cleaned.match(/^(A|B|AB|O)[+-]?$/);
  if (match) {
    if (cleaned.includes('+') || cleaned.includes('P')) return `${match[1]}+`;
    if (cleaned.includes('-') || cleaned.includes('N')) return `${match[1]}-`;
    return `${match[1]}+`; // default to positive
  }
  return undefined;
}

// ─── Phone normalization ───────────────────────────────────────────────────────
function parsePhone(value) {
  if (value === null || value === undefined) return null;
  let digits = String(value).replace(/[^0-9]/g, '');
  if (!digits) return null;

  // Handle scientific notation numbers (e.g., 9.18714E+11)
  if (String(value).includes('E') || String(value).includes('e')) {
    const num = Number(value);
    if (!isNaN(num)) digits = Math.round(num).toString();
  }

  // Remove country code prefix
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) return null;
  if (!/^[6-9]/.test(digits)) return null;
  
  return `+91${digits}`;
}

// ─── Date parsing ──────────────────────────────────────────────────────────────
function parseDate(dateString) {
  if (!dateString) return undefined;
  const raw = String(dateString).trim();
  if (!raw) return undefined;

  // Try DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY
  const dmyPatterns = [
    /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/,
    /^(\d{1,2})[-./](\d{1,2})[-./](\d{2})$/,
  ];

  for (const pattern of dmyPatterns) {
    const match = raw.match(pattern);
    if (match) {
      let [, day, month, year] = match.map(Number);
      if (year < 100) year += 1900;
      if (month > 12) [day, month] = [month, day]; // swap if month > 12
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1950) return date;
    }
  }

  // Try native parsing
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1950) return parsed;

  return undefined;
}

// ─── Generate code from name ───────────────────────────────────────────────────
function generateCode(name, existingCodes) {
  let base = name.trim().toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(word => word.substring(0, 3))
    .join('')
    .substring(0, 6);
  
  if (!base) base = 'GRP';
  
  let code = base;
  let counter = 1;
  while (existingCodes.has(code)) {
    code = `${base}${counter}`;
    counter++;
  }
  existingCodes.add(code);
  return code;
}

// ─── Districts to EXCLUDE (these are not actual districts) ─────────────────────
const INVALID_DISTRICTS = new Set([
  'DISTRICT',
  '',
  'COMMUNITY ENGAGEMENTS',
  'ISLAMIC STUDIES&ACTIVISM',
  'BUSINESS/MARKETING/ENTREPRENEURSHIP/STARTUPS',
  'SAFI INSTITUTE OF ADVANCED STUDY(AUTONOMOUS)',
]);

// ─── Groups to EXCLUDE (these are headers/invalid) ─────────────────────────────
const INVALID_GROUPS = new Set([
  'MEMBERS GROUP',
  'AVAILABLE IN AREA/DISTRICT',
  '',
]);

// ─── Main execution ────────────────────────────────────────────────────────────
async function run() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(DRY_RUN 
    ? '  🔍 DRY RUN — no changes will be written to the database' 
    : '  ⚡ EXECUTE MODE — ALL existing data will be REPLACED');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log(`📂 Excel file: ${EXCEL_PATH}\n`);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in .env');
  }

  // ─── 1. Read Excel ─────────────────────────────────────────────────────────
  console.log('📖 Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  console.log(`   Found ${rows.length} rows in sheet "${sheetName}"\n`);

  // ─── 2. Extract unique districts and areas ─────────────────────────────────
  console.log('🗂️  Extracting districts and areas...');
  
  const districtAreaMap = new Map(); // district -> Set of areas
  
  for (const row of rows) {
    const district = String(row['DISTRICT'] || '').trim().toUpperCase();
    const area = String(row['MEMBERS GROUP'] || '').trim().toUpperCase();
    
    if (INVALID_DISTRICTS.has(district)) continue;
    if (!district) continue;
    
    if (!districtAreaMap.has(district)) {
      districtAreaMap.set(district, new Set());
    }
    
    if (area && !INVALID_GROUPS.has(area)) {
      districtAreaMap.get(district).add(area);
    }
  }

  console.log(`   Districts: ${districtAreaMap.size}`);
  let totalAreas = 0;
  for (const [dist, areas] of districtAreaMap) {
    totalAreas += areas.size;
    console.log(`     ${dist}: ${areas.size} areas`);
  }
  console.log(`   Total areas: ${totalAreas}\n`);

  // ─── 3. Connect to DB ──────────────────────────────────────────────────────
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('🔌 Connected to MongoDB\n');

  // Find approver admin (needed for createdBy field)
  const approver = await User.findOne({ role: 'state_admin', isActive: true }).sort({ createdAt: 1 });
  if (!approver) {
    throw new Error('No active state_admin user found. Need at least one for createdBy references.');
  }
  console.log(`👤 Using admin: ${approver.name} (${approver._id})\n`);

  if (DRY_RUN) {
    console.log('─── DRY RUN SUMMARY ───────────────────────────────────────');
    console.log(`Would DELETE:`);
    console.log(`  - ${await Member.countDocuments()} members`);
    console.log(`  - ${await MemberAuth.countDocuments()} member auth records`);
    console.log(`  - ${await Group.countDocuments()} groups`);
    console.log(`  - ${await District.countDocuments()} districts`);
    console.log(`Would CREATE:`);
    console.log(`  - ${districtAreaMap.size} districts`);
    console.log(`  - ${totalAreas} areas (groups)`);
    console.log(`  - Up to ${rows.length} members`);
    console.log('───────────────────────────────────────────────────────────\n');
    console.log('Run with --execute to apply changes.');
    await mongoose.disconnect();
    return;
  }

  // ─── 4. Delete existing data ───────────────────────────────────────────────
  console.log('🗑️  Removing existing data...');
  const deletedMembers = await Member.deleteMany({});
  console.log(`   Deleted ${deletedMembers.deletedCount} members`);
  
  const deletedAuth = await MemberAuth.deleteMany({});
  console.log(`   Deleted ${deletedAuth.deletedCount} member auth records`);
  
  const deletedGroups = await Group.deleteMany({});
  console.log(`   Deleted ${deletedGroups.deletedCount} groups`);
  
  const deletedDistricts = await District.deleteMany({});
  console.log(`   Deleted ${deletedDistricts.deletedCount} districts\n`);

  // ─── 5. Create districts ───────────────────────────────────────────────────
  console.log('🏛️  Creating districts...');
  const districtCodes = new Set();
  const districtDbMap = new Map(); // district name -> DB document

  for (const districtName of districtAreaMap.keys()) {
    const code = generateCode(districtName, districtCodes);
    const district = new District({
      name: districtName,
      code,
      state: 'Kerala',
      isActive: true,
      createdBy: approver._id,
    });
    await district.save();
    districtDbMap.set(districtName, district);
    console.log(`   ✅ ${districtName} (${code})`);
  }
  console.log(`   Created ${districtDbMap.size} districts\n`);

  // ─── 6. Create areas (groups) ──────────────────────────────────────────────
  console.log('📍 Creating areas (groups)...');
  const groupCodes = new Set();
  const groupDbMap = new Map(); // "DISTRICT|AREA" -> DB document

  for (const [districtName, areas] of districtAreaMap) {
    const district = districtDbMap.get(districtName);
    if (!district) continue;

    for (const areaName of areas) {
      const code = generateCode(areaName, groupCodes);
      const group = new Group({
        name: areaName,
        code,
        district: district._id,
        isActive: true,
        createdBy: approver._id,
      });
      await group.save();
      groupDbMap.set(`${districtName}|${areaName}`, group);
    }
    console.log(`   ✅ ${districtName}: ${areas.size} areas created`);
  }
  console.log(`   Created ${groupDbMap.size} areas total\n`);

  // ─── 7. Create members ─────────────────────────────────────────────────────
  console.log('👥 Creating members...');
  const stats = {
    total: rows.length,
    created: 0,
    skippedInvalidDistrict: 0,
    skippedInvalidPhone: 0,
    skippedDuplicatePhone: 0,
    skippedNoArea: 0,
    errors: 0,
  };
  const failures = [];
  const seenPhones = new Set();
  const touchedDistricts = new Set();
  const touchedGroups = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (1-indexed + header)
    
    const name = String(row['NAME'] || '').trim();
    const districtName = String(row['DISTRICT'] || '').trim().toUpperCase();
    const areaName = String(row['MEMBERS GROUP'] || '').trim().toUpperCase();
    const unit = String(row['UNIT'] || '').trim();
    const dob = row['DOB'];
    const phoneRaw = row['PHONE NUMBER'];
    const profession = String(row['PROFESSION'] || '').trim();
    const qualification = String(row['QUALIFICATION'] || '').trim();
    const areaOfInterest = String(row['AREA OF INTREST'] || '').trim();
    const skills = String(row['SKILLS'] || '').trim();
    const bloodGroup = normalizeBloodGroup(row['BLOOD GROUP']);
    const statusRaw = String(row['STATUS'] || '').trim().toUpperCase();
    const outLocation = String(row['DISTRICT / STATE / COUNTRY IF OUT OF PLACE'] || '').trim();

    // Skip invalid districts
    if (INVALID_DISTRICTS.has(districtName) || !districtName) {
      stats.skippedInvalidDistrict++;
      continue;
    }

    // Skip if no area
    if (!areaName || INVALID_GROUPS.has(areaName)) {
      stats.skippedNoArea++;
      failures.push({ row: rowNum, name, reason: `No valid area/members group: "${areaName}"` });
      continue;
    }

    // Validate phone
    const phone = parsePhone(phoneRaw);
    if (!phone) {
      stats.skippedInvalidPhone++;
      failures.push({ row: rowNum, name, reason: `Invalid/missing phone: "${phoneRaw}"` });
      continue;
    }

    // Check duplicate phone in this batch
    if (seenPhones.has(phone)) {
      stats.skippedDuplicatePhone++;
      failures.push({ row: rowNum, name, reason: `Duplicate phone in data: ${phone}` });
      continue;
    }
    seenPhones.add(phone);

    // Resolve district
    const district = districtDbMap.get(districtName);
    if (!district) {
      stats.skippedInvalidDistrict++;
      failures.push({ row: rowNum, name, reason: `District not created: "${districtName}"` });
      continue;
    }

    // Resolve group
    const group = groupDbMap.get(`${districtName}|${areaName}`);
    if (!group) {
      stats.skippedNoArea++;
      failures.push({ row: rowNum, name, reason: `Area not found in ${districtName}: "${areaName}"` });
      continue;
    }

    // Determine status
    const status = STATUS_MAP[statusRaw] || 'Active';

    try {
      const member = new Member({
        name: name || 'Unknown',
        phone,
        dateOfBirth: parseDate(dob),
        bloodGroup,
        profession: profession || undefined,
        education: qualification || undefined,
        areaOfInterest: areaOfInterest || undefined,
        skills: skills || undefined,
        address: unit || undefined,
        district: district._id,
        group: group._id,
        status,
        isApproved: true,
        approvedBy: approver._id,
        approvedAt: new Date(),
        createdBy: approver._id,
        notes: outLocation ? `Location: ${outLocation}` : undefined,
      });

      await member.save();

      // Create MemberAuth for dashboard login
      const auth = new MemberAuth({
        member: member._id,
        phone,
        isActive: true,
      });
      await auth.save();

      stats.created++;
      touchedDistricts.add(String(district._id));
      touchedGroups.add(String(group._id));

      if (stats.created % 100 === 0) {
        console.log(`   ... ${stats.created} members created`);
      }
    } catch (err) {
      stats.errors++;
      failures.push({ row: rowNum, name, reason: err.message });
    }
  }

  console.log(`   ✅ Created ${stats.created} members\n`);

  // ─── 8. Update statistics ──────────────────────────────────────────────────
  console.log('📊 Updating statistics...');
  for (const districtId of touchedDistricts) {
    const district = await District.findById(districtId);
    if (district && district.updateStatistics) {
      await district.updateStatistics();
    }
  }
  for (const groupId of touchedGroups) {
    const group = await Group.findById(groupId);
    if (group && group.updateStatistics) {
      await group.updateStatistics();
    }
  }
  console.log('   Done.\n');

  // ─── 9. Final Report ───────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MIGRATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total rows in Excel:      ${stats.total}`);
  console.log(`  Members created:          ${stats.created}`);
  console.log(`  Skipped (invalid district): ${stats.skippedInvalidDistrict}`);
  console.log(`  Skipped (invalid phone):    ${stats.skippedInvalidPhone}`);
  console.log(`  Skipped (duplicate phone):  ${stats.skippedDuplicatePhone}`);
  console.log(`  Skipped (no area):          ${stats.skippedNoArea}`);
  console.log(`  Errors:                     ${stats.errors}`);
  console.log(`  Districts created:          ${districtDbMap.size}`);
  console.log(`  Areas created:              ${groupDbMap.size}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // ─── 10. Failure details ───────────────────────────────────────────────────
  if (failures.length > 0) {
    console.log(`\n⚠️  FAILURES (${failures.length}):`);
    console.log('───────────────────────────────────────────────────────────');
    for (const f of failures) {
      console.log(`  Row ${f.row}: ${f.name || '(no name)'} — ${f.reason}`);
    }
    console.log('───────────────────────────────────────────────────────────\n');

    // Write failures to file
    const failurePath = join(__dirname, 'migration-failures.json');
    const { writeFileSync } = await import('fs');
    writeFileSync(failurePath, JSON.stringify(failures, null, 2));
    console.log(`  📄 Failure details saved to: ${failurePath}\n`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

run().catch(err => {
  console.error('\n❌ MIGRATION FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
