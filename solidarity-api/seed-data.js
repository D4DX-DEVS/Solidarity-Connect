import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import connectDB from './src/config/database.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import Member from './src/models/Member.js';
import User from './src/models/User.js';
import MemberAuth from './src/models/MemberAuth.js';

dotenv.config();

// Function to generate district code from name
function generateDistrictCode(name) {
  return name.toUpperCase().replace(/\s+/g, '').substring(0, 10);
}

// Function to generate group code from name
function generateGroupCode(name, index) {
  const cleanName = name.replace(/[^A-Z0-9]/g, '').substring(0, 6);
  return `${cleanName}${String(index + 1).padStart(2, '0')}`;
}

// Function to parse date from various formats
function parseDate(dateStr) {
  if (!dateStr || dateStr === '' || typeof dateStr !== 'string') return null;
  
  // Handle different date formats
  const formats = [
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // D-M-YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // D.M.YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // D/M/YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }
  
  // Try parsing as number (timestamp)
  if (!isNaN(dateStr)) {
    const timestamp = parseInt(dateStr);
    if (timestamp > 1000000) { // Reasonable timestamp
      return new Date(timestamp);
    }
  }
  
  return null;
}

// Function to clean phone number
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  
  // Convert to string and remove all non-digits
  const cleaned = String(phone).replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.length === 10 && cleaned.match(/^[6-9]/)) {
    return cleaned; // 10-digit Indian mobile
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned.substring(2); // Remove country code
  } else if (cleaned.length === 13 && cleaned.startsWith('919')) {
    return cleaned.substring(3); // Remove country code with extra 9
  }
  
  return null;
}

// Function to normalize blood group
function normalizeBloodGroup(bloodGroup) {
  if (!bloodGroup || bloodGroup === '') return undefined;
  
  const normalized = bloodGroup.toUpperCase()
    .replace(/VE$/, '') // Remove 've' suffix
    .replace(/POSITIVE$/, '+') // Replace 'Positive' with '+'
    .replace(/NEGATIVE$/, '-') // Replace 'Negative' with '-'
    .replace(/\s+/g, '') // Remove spaces
    .trim();
  
  // Valid blood groups
  const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  return validGroups.includes(normalized) ? normalized : undefined;
}

// Function to extract data from csvjson.json
function extractDataFromCSV() {
  try {
    const csvData = JSON.parse(fs.readFileSync('./csvjson.json', 'utf8'));
    
    // Extract unique districts
    const districtSet = new Set();
    const groupsByDistrict = new Map();
    
    csvData.forEach(member => {
      const district = member.DISTRICT;
      const group = member['MEMBERS GROUP'];
      
      if (district) {
        districtSet.add(district);
        
        if (!groupsByDistrict.has(district)) {
          groupsByDistrict.set(district, new Set());
        }
        
        if (group) {
          groupsByDistrict.get(district).add(group);
        }
      }
    });
    
    // Create districts array
    const districts = Array.from(districtSet).map(name => ({
      name: name,
      code: generateDistrictCode(name),
      state: 'Kerala',
      description: `${name} district of Kerala`,
      contactInfo: {
        phone: `987654${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        email: `${name.toLowerCase().replace(/\s+/g, '')}@solidarity.org`,
        address: `${name}, Kerala`
      }
    }));
    
    // Create groups array
    const groups = [];
    let groupIndex = 0;
    
    for (const [districtName, groupSet] of groupsByDistrict) {
      const districtCode = generateDistrictCode(districtName);
      Array.from(groupSet).forEach(groupName => {
        groups.push({
          name: groupName,
          code: generateGroupCode(groupName, groupIndex++),
          districtCode: districtCode,
          districtName: districtName
        });
      });
    }
    
    // Extract all members with valid data
    const members = csvData
      .filter(member => 
        member.NAME && 
        String(member.NAME).trim() !== '' &&
        member['PHONE NUMBER'] && 
        member.DISTRICT && 
        member['MEMBERS GROUP'] &&
        member.STATUS !== 'NEED TO REMOVE' &&
        member.STATUS !== 'UNKNOWN'
      )
      .map(member => ({
        name: String(member.NAME || '').trim(),
        phone: cleanPhoneNumber(member['PHONE NUMBER']),
        email: member.EMAIL && String(member.EMAIL).trim() !== '' ? String(member.EMAIL).trim() : undefined,
        dateOfBirth: parseDate(member.DOB),
        profession: member.PROFESSION && String(member.PROFESSION).trim() !== '' ? String(member.PROFESSION).trim() : undefined,
        education: member.QUALIFICATION && String(member.QUALIFICATION).trim() !== '' ? String(member.QUALIFICATION).trim() : undefined,
        areaOfInterest: member['AREA OF INTREST'] && String(member['AREA OF INTREST']).trim() !== '' ? String(member['AREA OF INTREST']).trim() : undefined,
        skills: member.SKILLS && String(member.SKILLS).trim() !== '' ? String(member.SKILLS).trim() : undefined,
        bloodGroup: member['BLOOD GROUP'] && String(member['BLOOD GROUP']).trim() !== '' ? String(member['BLOOD GROUP']).trim() : undefined,
        address: member.UNIT && String(member.UNIT).trim() !== '' && String(member.UNIT).trim() !== 'Nil' ? String(member.UNIT).trim() : undefined,
        status: member.STATUS === 'AVAILABLE IN AREA/DISTRICT' ? 'Active' : 
                member.STATUS === 'ABROAD' ? 'Abroad' : 
                member.STATUS === 'OUT OF DISTRICT' ? 'Inactive' :
                member.STATUS === 'OUT OF STATE' ? 'Inactive' : 'Inactive',
        districtName: String(member.DISTRICT || ''),
        groupName: String(member['MEMBERS GROUP'] || '')
      }))
      .filter(member => member.phone && member.name); // Only include members with valid phone numbers and names
    
    return { districts, groups, members };
    
  } catch (error) {
    console.error('Error reading CSV data:', error);
    return { districts: [], groups: [], members: [] };
  }
}

async function seedDatabase() {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Extract data from CSV
    console.log('\n📊 Extracting data from csvjson.json...');
    const { districts, groups, members } = extractDataFromCSV();
    console.log(`   Found ${districts.length} districts`);
    console.log(`   Found ${groups.length} groups`);
    console.log(`   Found ${members.length} members`);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('\n🧹 Clearing existing data...');
    await Member.deleteMany({});
    await Group.deleteMany({});
    await District.deleteMany({});
    await User.deleteMany({});
    await MemberAuth.deleteMany({});
    console.log('✅ Existing data cleared');

    // Create state admin user first
    console.log('\n👤 Creating state admin user...');
    const stateAdmin = new User({
      name: 'State Admin',
      phone: '9876543210',
      role: 'state_admin'
    });
    await stateAdmin.save();
    console.log(`✅ State admin created: ${stateAdmin.name}`);

    // Create districts
    console.log('\n🏛️ Creating districts...');
    const districtMap = new Map();
    for (const districtData of districts) {
      const district = new District({
        ...districtData,
        createdBy: stateAdmin._id
      });
      await district.save();
      districtMap.set(district.name, district);
      console.log(`✅ District created: ${district.name} (${district.code})`);
    }

    // Create sample district admins
    console.log('\n👥 Creating district admin users...');
    const userMap = new Map();
    let phoneCounter = 9876543230;
    
    for (const district of districts.slice(0, 5)) { // Create admins for first 5 districts
      const user = new User({
        name: `${district.name} District Admin`,
        phone: phoneCounter.toString(),
        role: 'district_admin',
        district: districtMap.get(district.name)._id
      });
      await user.save();
      userMap.set(district.name, user);
      console.log(`✅ District admin created: ${user.name}`);
      phoneCounter++;
    }

    // Create groups
    console.log('\n👥 Creating groups...');
    const groupMap = new Map();
    for (const groupData of groups) {
      const district = districtMap.get(groupData.districtName);
      if (!district) {
        console.log(`❌ District not found for group: ${groupData.name}`);
        continue;
      }

      const group = new Group({
        name: groupData.name,
        code: groupData.code,
        district: district._id,
        createdBy: stateAdmin._id
      });
      await group.save();
      groupMap.set(`${groupData.districtName}-${groupData.name}`, group);
      console.log(`✅ Group created: ${group.name} (${group.code}) in ${district.name}`);
    }

    // Create sample group admins for first few groups
    console.log('\n👤 Creating group admin users...');
    const firstGroups = groups.slice(0, 10);
    for (const groupData of firstGroups) {
      const group = groupMap.get(`${groupData.districtName}-${groupData.name}`);
      const district = districtMap.get(groupData.districtName);
      
      if (group && district) {
        const user = new User({
          name: `${groupData.name} Group Admin`,
          phone: phoneCounter.toString(),
          role: 'group_admin',
          district: district._id,
          group: group._id
        });
        await user.save();
        
        // Update group admin reference
        group.admin = user._id;
        await group.save();
        
        console.log(`✅ Group admin created: ${user.name}`);
        phoneCounter++;
      }
    }

    // Create members
    console.log('\n👤 Creating members...');
    console.log(`Processing ${members.length} members from CSV data...`);
    
    let memberCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process members in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(members.length/batchSize)} (${batch.length} members)...`);
      
      for (const memberData of batch) {
        const group = groupMap.get(`${memberData.districtName}-${memberData.groupName}`);
        const district = districtMap.get(memberData.districtName);
        
        if (!group || !district) {
          console.log(`❌ Group or district not found for member: ${memberData.name} (${memberData.districtName} - ${memberData.groupName})`);
          errorCount++;
          continue;
        }

        // Skip if phone number already exists
        const existingMember = await Member.findOne({ phone: memberData.phone });
        if (existingMember) {
          skippedCount++;
          continue;
        }
        
        const member = new Member({
          name: memberData.name,
          phone: memberData.phone,
          email: memberData.email,
          dateOfBirth: memberData.dateOfBirth,
          profession: memberData.profession,
          education: memberData.education,
          areaOfInterest: memberData.areaOfInterest,
          skills: memberData.skills,
          address: memberData.address,
          bloodGroup: normalizeBloodGroup(memberData.bloodGroup),
          district: district._id, // ObjectId reference
          group: group._id, // ObjectId reference
          status: memberData.status,
          isApproved: memberData.status === 'Active',
          approvedBy: memberData.status === 'Active' ? stateAdmin._id : undefined,
          approvedAt: memberData.status === 'Active' ? new Date() : undefined,
          createdBy: stateAdmin._id,
          baithulMaal: {
            monthlyAmount: Math.floor(Math.random() * 300) + 100 // Random amount between 100-400
          }
        });
        
        try {
          await member.save();
          memberCount++;
          
          // Create MemberAuth for login (only for active members)
          if (memberData.status === 'Active') {
            try {
              await MemberAuth.createForMember(member._id);
            } catch (authError) {
              // Silently continue if MemberAuth creation fails
            }
          }
          
          if (memberCount % 50 === 0) {
            console.log(`✅ Created ${memberCount} members so far...`);
          }
        } catch (error) {
          console.log(`❌ Failed to create member ${memberData.name}: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log(`\n📊 Member creation summary:`);
    console.log(`   ✅ Successfully created: ${memberCount}`);
    console.log(`   ⚠️ Skipped (duplicates): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // Update statistics
    console.log('\n📊 Updating statistics...');
    for (const [name, district] of districtMap) {
      await district.updateStatistics();
    }
    for (const [key, group] of groupMap) {
      await group.updateStatistics();
    }
    console.log('✅ Statistics updated');

    // Display summary
    console.log('\n📋 Seed Data Summary:');
    console.log(`   Districts: ${districtMap.size}`);
    console.log(`   Groups: ${groupMap.size}`);
    console.log(`   Members: ${memberCount}`);
    console.log(`   Users: ${1 + userMap.size + firstGroups.length}`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('   State Admin: 9876543210 (any 4-digit OTP)');
    
    console.log('\n   District Admins:');
    for (const [districtName, user] of userMap) {
      console.log(`   ${districtName}: ${user.phone} (any 4-digit OTP)`);
    }
    
    console.log('\n   Sample Member Logins (first 10):');
    members.slice(0, 10).forEach(member => {
      console.log(`   ${member.name}: ${member.phone} (any 4-digit OTP)`);
    });

    console.log('\n🎉 Database seeded successfully with real data from CSV!');

  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedDatabase();