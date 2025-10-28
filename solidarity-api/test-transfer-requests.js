// Quick test script to check transfer requests in the database
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TransferRequest from './src/models/TransferRequest.js';
import Member from './src/models/Member.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import User from './src/models/User.js';

dotenv.config();

async function testTransferRequests() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all pending transfer requests
    const pendingRequests = await TransferRequest.find({ status: 'pending' })
      .populate('member', 'name phone')
      .populate('currentDistrict', 'name code')
      .populate('currentGroup', 'name code')
      .populate('targetDistrict', 'name code')
      .populate('targetGroup', 'name code')
      .populate('requestedBy', 'name phone role')
      .lean();

    console.log('\n=== PENDING TRANSFER REQUESTS ===');
    console.log(`Total pending requests: ${pendingRequests.length}\n`);

    pendingRequests.forEach((req, index) => {
      const isCrossDistrict = req.currentDistrict._id.toString() !== req.targetDistrict._id.toString();
      console.log(`${index + 1}. ${req.member.name}`);
      console.log(`   From: ${req.currentDistrict.name} - ${req.currentGroup.name}`);
      console.log(`   To: ${req.targetDistrict.name} - ${req.targetGroup.name}`);
      console.log(`   Type: ${isCrossDistrict ? 'Cross-District' : 'Within-District'}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Requested by: ${req.requestedBy.name} (${req.requestedBy.role})`);
      console.log(`   Created: ${new Date(req.createdAt).toLocaleString()}`);
      console.log('');
    });

    // Check all statuses
    const allRequests = await TransferRequest.find({}).lean();
    const statusCounts = allRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {});

    console.log('=== ALL TRANSFER REQUESTS BY STATUS ===');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testTransferRequests();
