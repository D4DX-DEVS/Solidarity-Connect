import mongoose from 'mongoose';
import User from '../models/User.js';
import District from '../models/District.js';
import Group from '../models/Group.js';
import Member from '../models/Member.js';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await District.deleteMany({});
    await Group.deleteMany({});
    await Member.deleteMany({});
    console.log('Cleared existing data');

    // Create State Admin
    const stateAdmin = await User.create({
      name: 'State Admin',
      phone: '+919656550933',
      email: 'admin@solidarity.org',
      role: 'state_admin'
    });

    // Create Districts
    const thrissurDistrict = await District.create({
      name: 'Thrissur',
      code: 'TSR',
      state: 'Kerala',
      description: 'Thrissur District',
      createdBy: stateAdmin._id
    });

    const malappuramDistrict = await District.create({
      name: 'Malappuram',
      code: 'MPM',
      state: 'Kerala',
      description: 'Malappuram District',
      createdBy: stateAdmin._id
    });

    // Create District Admin (only one for demo - user can select district during login)
    const districtAdmin = await User.create({
      name: 'District Admin',
      phone: '+919656550933',
      email: 'district@solidarity.org',
      role: 'district_admin',
      district: thrissurDistrict._id // Default to Thrissur, but can manage both
    });

    // Update district admin
    thrissurDistrict.admin = districtAdmin._id;
    malappuramDistrict.admin = districtAdmin._id;
    await thrissurDistrict.save();
    await malappuramDistrict.save();

    // Create Groups in Thrissur
    const varantharappalliGroup = await Group.create({
      name: 'Varantharappalli',
      code: 'VRP',
      district: thrissurDistrict._id,
      description: 'Varantharappalli Group',
      createdBy: districtAdmin._id
    });

    const perumpilavuGroup = await Group.create({
      name: 'Perumpilavu',
      code: 'PRP',
      district: thrissurDistrict._id,
      description: 'Perumpilavu Group',
      createdBy: districtAdmin._id
    });

    // Create Groups in Malappuram
    const manjeriGroup = await Group.create({
      name: 'Manjeri',
      code: 'MNJ',
      district: malappuramDistrict._id,
      description: 'Manjeri Group',
      createdBy: districtAdmin._id
    });

    // Create Group Admin (only one for demo - user can select group during login)
    const groupAdmin = await User.create({
      name: 'Group Admin (Murabbi)',
      phone: '+919656550933',
      email: 'group@solidarity.org',
      role: 'group_admin',
      district: thrissurDistrict._id,
      group: varantharappalliGroup._id // Default to Varantharappalli
    });

    // Update group admin
    varantharappalliGroup.admin = groupAdmin._id;
    perumpilavuGroup.admin = groupAdmin._id;
    manjeriGroup.admin = groupAdmin._id;
    await varantharappalliGroup.save();
    await perumpilavuGroup.save();
    await manjeriGroup.save();

    // No dummy members - system starts with empty member database
    console.log('✅ Administrative structure created - ready for real member data');

    // Update statistics for districts and groups
    await thrissurDistrict.updateStatistics();
    await malappuramDistrict.updateStatistics();
    await varantharappalliGroup.updateStatistics();
    await perumpilavuGroup.updateStatistics();
    await manjeriGroup.updateStatistics();

    console.log('✅ Administrative structure created successfully!');
    console.log('\n📊 Summary:');
    console.log(`👥 Users: ${await User.countDocuments()}`);
    console.log(`🏛️  Districts: ${await District.countDocuments()}`);
    console.log(`👥 Groups: ${await Group.countDocuments()}`);
    console.log(`👤 Members: ${await Member.countDocuments()} (ready for real data)`);

    console.log('\n🔑 Login Credentials:');
    console.log('📱 Phone Number: +919656550933 (for all user types)');
    console.log('\n👥 Available User Types:');
    console.log('  • state_admin - Full system access');
    console.log('  • district_admin - District level access');
    console.log('  • group_admin - Group level access (Murabbi)');
    console.log('\n💡 Use any 4-digit OTP for login in development mode');
    console.log('💡 Select the appropriate user type during login to access different roles');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData();
}

export default seedData;