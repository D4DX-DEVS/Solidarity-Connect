import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import User from './src/models/User.js';

dotenv.config();

async function addTestMember() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Check existing districts and groups
    const districts = await District.find().limit(5);
    const groups = await Group.find().limit(5);
    const users = await User.find().limit(1);

    console.log('\nExisting Districts:');
    districts.forEach(d => console.log(`- ${d.name} (${d._id})`));
    
    console.log('\nExisting Groups:');
    groups.forEach(g => console.log(`- ${g.name} (${g._id}) - District: ${g.district}`));

    if (districts.length === 0 || groups.length === 0 || users.length === 0) {
      console.log('\nError: Need at least one district, group, and user to create a member');
      process.exit(1);
    }

    // Check if member already exists
    const existingMember = await Member.findOne({ phone: '+919656550933' })
      .populate('district', 'name')
      .populate('group', 'name');
      
    if (existingMember) {
      console.log('\n✅ Member with phone +919656550933 already exists:');
      console.log(`- Name: ${existingMember.name}`);
      console.log(`- Status: ${existingMember.status}`);
      console.log(`- Approved: ${existingMember.isApproved}`);
      console.log(`- District: ${existingMember.district?.name || 'N/A'}`);
      console.log(`- Group: ${existingMember.group?.name || 'N/A'}`);
      
      // Check if MemberAuth exists
      let memberAuth = await MemberAuth.findOne({ member: existingMember._id });
      if (memberAuth) {
        console.log(`- MemberAuth exists: ${memberAuth.isActive ? 'Active' : 'Inactive'}`);
      } else {
        try {
          console.log('- Creating MemberAuth record...');
          memberAuth = await MemberAuth.createForMember(existingMember._id);
          console.log('- MemberAuth created successfully');
        } catch (error) {
          if (error.code === 11000) {
            console.log('- MemberAuth already exists (duplicate key)');
            memberAuth = await MemberAuth.findOne({ phone: '+919656550933' });
          } else {
            throw error;
          }
        }
      }
      
      console.log('\n🎯 Member is ready for login testing!');
      console.log('📱 Phone: +919656550933 or 9656550933');
      console.log('🔐 Use any 4-digit OTP in development mode');
      console.log(`🔑 Member Auth Status: ${memberAuth?.isActive ? 'Active' : 'Inactive'}`);
      
      process.exit(0);
    }

    // Create new member
    const newMember = new Member({
      name: 'Test Member',
      phone: '+919656550933',
      email: 'testmember@example.com',
      dateOfBirth: new Date('1990-01-01'),
      profession: 'Software Developer',
      education: 'Bachelor of Technology',
      address: 'Test Address, Test City',
      district: districts[0]._id,
      group: groups[0]._id,
      status: 'Active',
      isApproved: true,
      approvedBy: users[0]._id,
      approvedAt: new Date(),
      createdBy: users[0]._id,
      baithulMaal: {
        monthlyAmount: 100
      }
    });

    await newMember.save();
    console.log('\n✅ Member created successfully:');
    console.log(`- Name: ${newMember.name}`);
    console.log(`- Phone: ${newMember.phone}`);
    console.log(`- District: ${districts[0].name}`);
    console.log(`- Group: ${groups[0].name}`);
    console.log(`- Status: ${newMember.status}`);
    console.log(`- Approved: ${newMember.isApproved}`);

    // Create MemberAuth record
    const memberAuth = await MemberAuth.createForMember(newMember._id);
    console.log('\n✅ MemberAuth created successfully');
    console.log(`- Active: ${memberAuth.isActive}`);

    console.log('\n🎯 Member is ready for login testing!');
    console.log('📱 Phone: +919656550933 or 9656550933');
    console.log('🔐 Use any 4-digit OTP in development mode');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

addTestMember();