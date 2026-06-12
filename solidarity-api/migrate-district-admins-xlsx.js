/**
 * Migration Script: Add District Admins from Excel file
 *
 * Source: District LEADERS 2.xlsx
 *
 * Logic:
 *   1. Read each district sheet/section from the Excel file
 *   2. Only process rows where "User type" = "District Admin"
 *   3. Check if they exist as Members (by phone) — log status
 *   4. Create/update User record with role=district_admin
 *
 * Usage:
 *   node migrate-district-admins-xlsx.js                    (dry run)
 *   node migrate-district-admins-xlsx.js --execute          (apply changes)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');

import User from './src/models/User.js';
import Member from './src/models/Member.js';

const districtSchema = new mongoose.Schema({ name: String, code: String }, { timestamps: true });
const District = mongoose.models.District || mongoose.model('District', districtSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(phone) {
  let p = String(phone).replace(/\s+/g, '').replace(/^0+/, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  return p; // 10-digit
}

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const results = [];
  let currentDistrict = null;

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    // Check columns A-D (left side) and G-J (right side) for district headers and data
    // Left side: columns 0-3 (A-D)
    // Right side: columns 6-9 (G-J) (after empty columns E, F)

    // Detect district header rows — a row where column A has a district name
    // and column B is "Phone" (header row) means previous row was district name
    if (row[0] && String(row[0]).trim() === 'Name' && String(row[1]).trim() === 'Phone') {
      // The district name is in the row above this header row
      const prevRow = rawData[i - 1];
      if (prevRow && prevRow[0]) {
        currentDistrict = String(prevRow[0]).trim();
      }
      continue;
    }

    // Check right-side header
    if (row[6] && String(row[6]).trim() === 'Name' && String(row[7]).trim() === 'Phone') {
      const prevRow = rawData[i - 1];
      if (prevRow && prevRow[6]) {
        // Right-side district — we'll process it separately below
      }
      continue;
    }

    // Skip if it's a district name row (no phone number)
    // Process left side data (columns A-D)
    if (row[0] && row[1] && String(row[1]).trim().match(/^\d{7,}/)) {
      const userType = String(row[2] || '').trim();
      if (userType.toLowerCase() === 'district admin') {
        results.push({
          name: String(row[0]).trim(),
          phone: String(row[1]).trim(),
          userType,
          role: String(row[3] || '').trim(),
          district: currentDistrict,
        });
      }
    }

    // Process right side data (columns G-J)
    if (row[6] && row[7] && String(row[7]).trim().match(/^\d{7,}/)) {
      const userType = String(row[8] || '').trim();
      if (userType.toLowerCase() === 'district admin') {
        // Find right-side district — look back for the header
        let rightDistrict = null;
        for (let j = i - 1; j >= 0; j--) {
          const checkRow = rawData[j];
          if (checkRow[6] && String(checkRow[6]).trim() === 'Name') {
            const distRow = rawData[j - 1];
            if (distRow && distRow[6]) {
              rightDistrict = String(distRow[6]).trim();
            }
            break;
          }
        }
        results.push({
          name: String(row[6]).trim(),
          phone: String(row[7]).trim(),
          userType,
          role: String(row[9] || '').trim(),
          district: rightDistrict,
        });
      }
    }
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n========================================================');
  console.log(DRY_RUN ? '  DRY RUN – no changes will be written' : '  EXECUTE MODE – changes WILL be written');
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // Read Excel file
  const xlsxPath = process.argv.find(a => a.endsWith('.xlsx')) || 'C:\\Users\\moham\\Downloads\\District LEADERS 2 .xlsx';
  console.log(`📄 Reading: ${xlsxPath}\n`);

  const admins = parseExcel(xlsxPath);
  console.log(`📊 Found ${admins.length} entries with "District Admin" user type\n`);

  if (admins.length === 0) {
    console.log('⚠️  No District Admin entries found. Check the file format.');
    await mongoose.disconnect();
    return;
  }

  // Load all districts
  const allDistricts = await District.find({}, 'name code').lean();
  console.log(`📋 Districts in DB: ${allDistricts.map(d => `${d.name} (${d.code})`).join(', ')}\n`);

  function findDistrict(name) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    // Exact match
    let match = allDistricts.find(d => d.name.toLowerCase() === lower);
    if (match) return match;
    // Partial/fuzzy match
    match = allDistricts.find(d =>
      d.name.toLowerCase().includes(lower) ||
      lower.includes(d.name.toLowerCase())
    );
    if (match) return match;
    // Handle common spelling variations
    const aliases = {
      'ernakulam': 'ERANAKULAM',
      'kozhikode': 'KOZHIKKODE',
      'kozhikkode': 'KOZHIKKODE',
      'calicut': 'KOZHIKKODE',
      'ernakulam': 'ERANAKULAM',
      'tvm': 'THIRUVANANTHAPURAM',
      'trivandrum': 'THIRUVANANTHAPURAM',
    };
    const alias = aliases[lower];
    if (alias) {
      match = allDistricts.find(d => d.name.toUpperCase() === alias);
    }
    return match || null;
  }

  const stats = { created: 0, updated: 0, alreadyCorrect: 0, districtNotFound: 0, isMember: 0, notMember: 0 };
  const errors = [];

  // Group by district for display
  const byDistrict = {};
  for (const admin of admins) {
    const d = admin.district || 'UNKNOWN';
    if (!byDistrict[d]) byDistrict[d] = [];
    byDistrict[d].push(admin);
  }

  console.log('─── District Admins to process ───────────────────────────\n');
  for (const [dist, entries] of Object.entries(byDistrict)) {
    console.log(`  ${dist}: ${entries.map(e => `${e.name} (${e.phone}) [${e.role}]`).join(', ')}`);
  }
  console.log('');

  // Process each admin
  console.log('═══ PROCESSING ══════════════════════════════════════════\n');

  for (const entry of admins) {
    const phone = normalizePhone(entry.phone);
    const district = findDistrict(entry.district);

    if (!district) {
      stats.districtNotFound++;
      errors.push(`${entry.name} (${phone}) — district "${entry.district}" not found in DB`);
      console.log(`   ❌ ${entry.name} (${phone}) — district "${entry.district}" NOT FOUND`);
      continue;
    }

    // Check if they are a member
    const member = await Member.findOne({ phone }).lean();
    if (member) {
      stats.isMember++;
      console.log(`   👤 ${entry.name} (${phone}) — IS a member (${member.name}, ${member.status})`);
    } else {
      stats.notMember++;
      console.log(`   ⚠️  ${entry.name} (${phone}) — NOT a member in the system`);
    }

    // Check if already exists as district_admin
    const existing = await User.findOne({ phone, role: 'district_admin' });

    if (existing) {
      const districtMatch = existing.district?.toString() === district._id.toString();
      if (districtMatch && existing.isActive) {
        stats.alreadyCorrect++;
        console.log(`   ⏭️  ${entry.name} (${phone}) — already district_admin for ${district.name}`);
      } else {
        if (DRY_RUN) {
          console.log(`   📋 ${entry.name} (${phone}) — would update: district → ${district.name}`);
        } else {
          existing.name = entry.name;
          existing.district = district._id;
          existing.isActive = true;
          await existing.save();
          console.log(`   ✅ ${entry.name} (${phone}) — updated district_admin → ${district.name}`);
        }
        stats.updated++;
      }
    } else {
      if (DRY_RUN) {
        console.log(`   📋 ${entry.name} (${phone}) — would create district_admin for ${district.name}`);
      } else {
        const newUser = new User({
          name: entry.name,
          phone,
          role: 'district_admin',
          district: district._id,
          isActive: true,
        });
        await newUser.save();
        console.log(`   ✅ ${entry.name} (${phone}) — created district_admin for ${district.name}`);
      }
      stats.created++;
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══ SUMMARY ═════════════════════════════════════════════\n');
  console.log(`   Total processed:     ${admins.length}`);
  console.log(`   Created:             ${stats.created}`);
  console.log(`   Updated:             ${stats.updated}`);
  console.log(`   Already correct:     ${stats.alreadyCorrect}`);
  console.log(`   District not found:  ${stats.districtNotFound}`);
  console.log(`   Are members:         ${stats.isMember}`);
  console.log(`   Not members:         ${stats.notMember}`);

  if (errors.length > 0) {
    console.log('\n   ⚠️  Errors:');
    errors.forEach(e => console.log(`      - ${e}`));
  }

  if (DRY_RUN) {
    console.log('\n   ℹ️  This was a DRY RUN. Run with --execute to apply changes.');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done\n');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
