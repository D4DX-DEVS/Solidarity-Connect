import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';

dotenv.config();

async function fixMemberAuth() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Find the member
    const member = await Member.findOne({ phone: '+919656550933' })
      .populate('district', 'name')
      .populate('group', 'name');

    if (!member) {
      console.log('Member not found');
      process.exit(1);
    }

    console.log('\n📋 Member Details:');
    console.log(`- Name: ${member.name}`);
    console.log(`- Phone: ${member.phone}`);
    console.log(`- Status: ${member.status}`);
    console.log(`- Approved: ${member.isApproved}`);
    console.log(`- District: ${member.district?.name || 'N/A'}`);
    console.log(`- Group: ${member.group?.name || 'N/A'}`);

    // Check existing MemberAuth records
    const memberAuths = await MemberAuth.find({
      $or: [
        { member: member._id },
        { phone: member.phone }
      ]
    });

    console.log(`\n🔍 Found ${memberAuths.length} MemberAuth record(s):`);
    memberAuths.forEach((auth, index) => {
      console.log(`${index + 1}. ID: ${auth._id}`);
      console.log(`   Member: ${auth.member}`);
      console.log(`   Phone: ${auth.phone}`);
      console.log(`   Active: ${auth.isActive}`);
      console.log(`   Created: ${auth.createdAt}`);
    });

    // Remove duplicate or incorrect records
    if (memberAuths.length > 1) {
      console.log('\n🧹 Cleaning up duplicate records...');
      
      // Keep the one that matches both member ID and phone
      const correctAuth = memberAuths.find(auth => 
        auth.member.toString() === member._id.toString() && 
        auth.phone === member.phone
      );

      if (correctAuth) {
        // Remove others
        const toRemove = memberAuths.filter(auth => auth._id.toString() !== correctAuth._id.toString());
        for (const auth of toRemove) {
          await MemberAuth.deleteOne({ _id: auth._id });
          console.log(`   Removed: ${auth._id}`);
        }
        console.log(`   Kept: ${correctAuth._id}`);
      } else {
        // Remove all and create new
        for (const auth of memberAuths) {
          await MemberAuth.deleteOne({ _id: auth._id });
          console.log(`   Removed: ${auth._id}`);
        }
        
        // Create new correct record
        const newAuth = new MemberAuth({
          member: member._id,
          phone: member.phone,
          isActive: member.status === 'Active' && member.isApproved
        });
        await newAuth.save();
        console.log(`   Created new: ${newAuth._id}`);
      }
    } else if (memberAuths.length === 1) {
      const auth = memberAuths[0];
      // Update if needed
      if (auth.member.toString() !== member._id.toString() || auth.phone !== member.phone) {
        auth.member = member._id;
        auth.phone = member.phone;
        auth.isActive = member.status === 'Active' && member.isApproved;
        await auth.save();
        console.log('   Updated existing record');
      } else {
        console.log('   Record is correct');
      }
    } else {
      // Create new record
      const newAuth = new MemberAuth({
        member: member._id,
        phone: member.phone,
        isActive: member.status === 'Active' && member.isApproved
      });
      await newAuth.save();
      console.log(`   Created new: ${newAuth._id}`);
    }

    // Verify final state
    const finalAuth = await MemberAuth.findOne({ member: member._id });
    console.log('\n✅ Final MemberAuth state:');
    console.log(`- ID: ${finalAuth._id}`);
    console.log(`- Member: ${finalAuth.member}`);
    console.log(`- Phone: ${finalAuth.phone}`);
    console.log(`- Active: ${finalAuth.isActive}`);

    console.log('\n🎯 Member is ready for login testing!');
    console.log('📱 Phone: +919656550933 or 9656550933');
    console.log('🔐 Use any 4-digit OTP in development mode');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixMemberAuth();