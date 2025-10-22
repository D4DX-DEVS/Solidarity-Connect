#!/usr/bin/env node

import mongoose from 'mongoose';
import Meeting from './src/models/Meeting.js';
import MeetingSession from './src/models/MeetingSession.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createTestMeetings = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check existing meetings
    const existingMeetings = await Meeting.countDocuments();
    console.log(`Existing meetings in database: ${existingMeetings}`);

    if (existingMeetings > 0) {
      console.log('Meetings already exist. Listing them:');
      const meetings = await Meeting.find({})
        .populate('createdBy', 'name role')
        .select('title meetingType targetAudience scheduledDate status');
      
      meetings.forEach(meeting => {
        console.log(`- ${meeting.title} (${meeting.meetingType}) - ${meeting.targetAudience} - ${meeting.status}`);
      });
      
      return;
    }

    // Find a user to create meetings (preferably state admin)
    const stateAdmin = await User.findOne({ role: 'state_admin' });
    if (!stateAdmin) {
      console.log('No state admin found. Please run seed data first: npm run seed');
      return;
    }

    console.log(`Creating test meetings with user: ${stateAdmin.name}`);

    // Create a general meeting for all group admins
    const generalMeeting = await Meeting.create({
      title: 'Monthly General Meeting - January 2025',
      description: 'General meeting for all group administrators to discuss monthly activities and