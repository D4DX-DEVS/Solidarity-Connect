import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import District from '../models/District.js';
import Group from '../models/Group.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Helper function to parse date from various formats
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Convert to string and trim if it's not already a string
  const dateString = typeof dateStr === 'string' ? dateStr.trim() : String(dateStr).trim();
  
  if (dateString === '' || dateString === 'null') return null;
  
  // Handle different date formats
  const formats = [
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // D/M/YYYY or DD/MM/YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // D.M.YYYY or DD.MM.YYYY
  ];
  
  for (const format of formats) {
    const match = dateString.match(format);
    if (match) {
      const [, day, month, year] = match;
      return new Date(year, month - 1, day);
    }
  }
  
  return null;
}

// Helper function to normalize phone number
function normalizePhone(phone) {
  if (!phone) return null;
  
  let phoneStr = phone.toString().replace(/\s+/g, '');
  
  // Remove any non-digit characters except +
  phoneStr = phoneStr.replace(/[^\d+]/g, '');
  
  // Handle different formats
  if (phoneStr.startsWith('+91') && phoneStr.length === 13) {
    return phoneStr;
  } else if (phoneStr.startsWith('91') && phoneStr.length === 12) {
    return '+' + phoneStr;
  } else if (phoneStr.length === 10 && phoneStr.match(/^[6-9]\d{9}$/)) {
    // Valid 10-digit Indian mobile number (starts with 6-9)
    return '+91' + phoneStr;
  }
  
  return null;
}

// Helper function to normalize blood group
function normalizeBloodGroup(bloodGroup) {
  if (!bloodGroup) return null;
  
  // Convert to string and trim if it's not already a string
  const bgString = typeof bloodGroup === 'string' ? bloodGroup.trim() : String(bloodGroup).trim();
  
  if (bgString === '' || bgString === 'null') return null;
  
  const bg = bgString.toUpperCase();
  const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  // Handle variations
  const normalized = bg
    .replace(/\s+/g, '')
    .replace('POSITIVE', '+')
    .replace('NEGATIVE', '-')
    .replace('VE', '')
    .replace('O POSITIVE', 'O+')
    .replace('O NEGATIVE', 'O-');
  
  return validGroups.includes(normalized) ? normalized : null;
}

// Helper function to map status
function mapStatus(status) {
  if (!status) return 'Inactive';
  
  const statusUpper = status.toUpperCase().trim();
  
  const statusMap = {
    'AVAILABLE IN AREA/DISTRICT': 'Active',
    'ABROAD': 'Abroad',
    'OUT OF DISTRICT': 'Inactive',
    'OUT OF STATE': 'Inactive',
    'NEED TO REMOVE': 'Dismissed',
    'UNKNOWN': 'Inactive'
  };
  
  return statusMap[statusUpper] || 'Inactive';
}

async function bulkImportMembers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get admin user for createdBy field
    const adminUser = await User.findOne({ role: 'state_admin' });
    if (!adminUser) {
      throw new Error('Admin user not found. Please run seed data first: npm run seed');
    }

    // Read CSV JSON data
    const csvPath = path.join(__dirname, '../../csvjson.json');
    const csvData = JSON.parse(fs.readFileSync(csvPath, 'utf8'));
    
    console.log(`Found ${csvData.length} records to import`);

    // Initialize tracking for phone number issues and removed records
    const phoneIssues = [];
    const removedRecords = [];
    let dummyPhoneCounter = 0; // Counter for dummy phones
    
    // Function to generate valid dummy phone numbers
    const generateDummyPhone = () => {
      // Format: +91[6-9]xxxxxxxxx (starts with 6-9, then 9 digits)
      const firstDigit = 6; // Start with 6
      const remainingDigits = String(dummyPhoneCounter).padStart(9, '0');
      dummyPhoneCounter++;
      return `+91${firstDigit}${remainingDigits}`;
    };

    // Step 1: Delete all existing data
    console.log('Deleting existing data...');
    await Member.deleteMany({});
    await Group.deleteMany({});
    await District.deleteMany({});
    console.log('Existing data deleted');

    // Step 2: Extract unique districts
    const uniqueDistricts = [...new Set(csvData.map(row => row.DISTRICT).filter(Boolean))];
    console.log(`Found ${uniqueDistricts.length} unique districts:`, uniqueDistricts);

    // Step 3: Create districts
    const districtMap = new Map();
    const usedDistrictCodes = new Set();
    
    for (const districtName of uniqueDistricts) {
      // Generate globally unique district code
      let baseCode = districtName.substring(0, 3).toUpperCase();
      let code = baseCode;
      let counter = 1;
      
      while (usedDistrictCodes.has(code)) {
        code = `${baseCode}${counter}`;
        counter++;
      }
      usedDistrictCodes.add(code);
      
      const district = new District({
        name: districtName,
        code: code,
        state: 'Kerala',
        createdBy: adminUser._id,
        isActive: true
      });
      
      await district.save();
      districtMap.set(districtName, district._id);
      console.log(`Created district: ${districtName} (${code})`);
    }

    // Step 4: Extract unique groups per district
    const groupsByDistrict = new Map();
    csvData.forEach(row => {
      if (row.DISTRICT && row['MEMBERS GROUP']) {
        const district = row.DISTRICT;
        const group = row['MEMBERS GROUP'];
        
        if (!groupsByDistrict.has(district)) {
          groupsByDistrict.set(district, new Set());
        }
        groupsByDistrict.get(district).add(group);
      }
    });

    // Step 5: Create groups
    const groupMap = new Map();
    const usedCodes = new Set();
    
    for (const [districtName, groups] of groupsByDistrict) {
      const districtId = districtMap.get(districtName);
      
      for (const groupName of groups) {
        // Generate globally unique code
        let baseCode = groupName.substring(0, 3).toUpperCase();
        let code = baseCode;
        let counter = 1;
        
        // Make sure code is globally unique across all districts
        while (usedCodes.has(code)) {
          code = `${baseCode}${counter}`;
          counter++;
        }
        usedCodes.add(code);
        
        const group = new Group({
          name: groupName,
          code: code,
          district: districtId,
          createdBy: adminUser._id,
          isActive: true
        });
        
        await group.save();
        groupMap.set(`${districtName}-${groupName}`, group._id);
        console.log(`Created group: ${groupName} (${code}) in ${districtName}`);
      }
    }

    // Step 6: Process and create members
    console.log('Creating members...');
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const usedPhones = new Set(); // Track phones used in this import

    for (const [index, row] of csvData.entries()) {
      try {
        // Skip if essential data is missing
        if (!row.NAME || !row.DISTRICT || !row['MEMBERS GROUP']) {
          console.log(`Skipping row ${index + 1}: Missing essential data`);
          errorCount++;
          continue;
        }

        const districtId = districtMap.get(row.DISTRICT);
        const groupId = groupMap.get(`${row.DISTRICT}-${row['MEMBERS GROUP']}`);
        
        if (!districtId || !groupId) {
          console.log(`Skipping row ${index + 1}: District or Group not found`);
          errorCount++;
          continue;
        }

        // Parse and normalize data
        let phone = normalizePhone(row['PHONE NUMBER']);
        const dateOfBirth = parseDate(row.DOB);
        const bloodGroup = normalizeBloodGroup(row['BLOOD GROUP']);
        const status = mapStatus(row.STATUS);

        // Skip records marked for removal
        if (row.STATUS && row.STATUS.toUpperCase().trim() === 'NEED TO REMOVE') {
          removedRecords.push({
            rowNumber: index + 1,
            name: row.NAME,
            phone: row['PHONE NUMBER'],
            district: row.DISTRICT,
            group: row['MEMBERS GROUP'],
            reason: 'NEED TO REMOVE status'
          });
          console.log(`Skipping row ${index + 1} (${row.NAME}): Marked for removal`);
          continue;
        }

        // Handle invalid or duplicate phone numbers
        let phoneIssueType = null;
        let originalPhone = row['PHONE NUMBER'];
        
        if (!phone) {
          // Invalid phone number - use dummy
          phone = generateDummyPhone();
          phoneIssueType = 'INVALID';
        } else if (usedPhones.has(phone)) {
          // Duplicate phone in current import - use dummy
          phoneIssueType = 'DUPLICATE';
          originalPhone = phone;
          phone = generateDummyPhone();
        }

        // Add phone to used set
        usedPhones.add(phone);

        // Track phone issues
        if (phoneIssueType) {
          phoneIssues.push({
            rowNumber: index + 1,
            name: row.NAME,
            originalPhone: originalPhone,
            assignedPhone: phone,
            issueType: phoneIssueType,
            district: row.DISTRICT,
            group: row['MEMBERS GROUP']
          });
        }

        // Helper function to handle null/empty values
        const getValue = (value, defaultValue = '') => {
          if (value === null || value === undefined || value === '' || value === 'null') {
            return defaultValue;
          }
          return typeof value === 'string' ? value.trim() : value;
        };

        // Helper function to truncate text to max length
        const truncateText = (text, maxLength) => {
          if (!text) return '';
          const str = getValue(text);
          return str.length > maxLength ? str.substring(0, maxLength) : str;
        };

        // Create member object with field length limits
        const memberData = {
          name: truncateText(row.NAME, 100) || 'Unknown',
          phone: phone,
          dateOfBirth: dateOfBirth,
          profession: truncateText(row.PROFESSION, 100),
          education: truncateText(row.QUALIFICATION, 100),
          areaOfInterest: truncateText(row['AREA OF INTREST'], 200),
          skills: truncateText(row.SKILLS, 200),
          address: truncateText(row.UNIT, 500), // Store UNIT in address field
          district: districtId,
          group: groupId,
          status: status,
          isApproved: status === 'Active',
          createdBy: adminUser._id,
          notes: truncateText(`Original data - Unit: ${getValue(row.UNIT)}`, 1000)
        };

        // Only add bloodGroup if it's valid (leave empty if null/invalid)
        if (bloodGroup) {
          memberData.bloodGroup = bloodGroup;
        }

        // Remove empty string fields (but keep required fields)
        Object.keys(memberData).forEach(key => {
          if (memberData[key] === '' && !['name', 'phone', 'district', 'group', 'status', 'createdBy'].includes(key)) {
            delete memberData[key];
          }
        });

        const member = new Member(memberData);
        await member.save();
        
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Processed ${successCount} members...`);
        }

      } catch (error) {
        errorCount++;
        errors.push({
          row: index + 1,
          name: row.NAME,
          error: error.message
        });
        console.log(`Error processing row ${index + 1} (${row.NAME}): ${error.message}`);
      }
    }

    // Step 7: Update statistics for all districts and groups
    console.log('Updating statistics...');
    for (const district of await District.find()) {
      await district.updateStatistics();
    }
    
    for (const group of await Group.find()) {
      await group.updateStatistics();
    }

    // Save phone issues to file for later reference
    if (phoneIssues.length > 0) {
      const issuesPath = path.join(__dirname, '../../phone_issues_report.json');
      fs.writeFileSync(issuesPath, JSON.stringify(phoneIssues, null, 2));
      console.log(`\nPhone issues saved to: ${issuesPath}`);
    }

    // Save removed records to file for later reference
    if (removedRecords.length > 0) {
      const removedPath = path.join(__dirname, '../../removed_records_report.json');
      fs.writeFileSync(removedPath, JSON.stringify(removedRecords, null, 2));
      console.log(`Removed records saved to: ${removedPath}`);
    }

    // Summary
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Total records processed: ${csvData.length}`);
    console.log(`Successfully imported: ${successCount} members`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Districts created: ${uniqueDistricts.length}`);
    console.log(`Groups created: ${Array.from(groupMap.keys()).length}`);
    console.log(`Records removed (NEED TO REMOVE): ${removedRecords.length}`);
    console.log(`Phone issues handled: ${phoneIssues.length}`);
    console.log(`  - Invalid phone numbers: ${phoneIssues.filter(p => p.issueType === 'INVALID').length}`);
    console.log(`  - Duplicate phone numbers: ${phoneIssues.filter(p => p.issueType === 'DUPLICATE').length}`);

    if (errors.length > 0) {
      console.log('\nErrors encountered:');
      errors.slice(0, 10).forEach(error => {
        console.log(`Row ${error.row} (${error.name}): ${error.error}`);
      });
      if (errors.length > 10) {
        console.log(`... and ${errors.length - 10} more errors`);
      }
    }

    console.log('\nBulk import completed successfully!');

  } catch (error) {
    console.error('Bulk import failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the import
if (import.meta.url === `file://${process.argv[1]}`) {
  bulkImportMembers();
}

export default bulkImportMembers;