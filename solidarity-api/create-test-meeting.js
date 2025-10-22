#!/usr/bin/env node

/**
 * Script to create a test meeting for debugging
 */

import mongoose from 'mongoose';
import Meeting from './src/models/Meeting.js';
import MeetingSession from './src/models/MeetingSession.js';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestMeeting() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a user to create the meeting (preferably state admin)
    const creator = await User.findOne({ role: 'state_admin' });
    if (!creator) {
      console.log('No state admin found. Creating a basic user...');
      const testUser = await User.create({
        name: 'Test Admin',
        phone: '+919999999999',
        email: 'test@solidarity.org',
        role: 'state_admin'
      });
      console.log('Created test user:', testUser.name);
    }

    const creatorUser = creator || await User.findOne({ role: 'state_admin' });

    // Check if test meeting already exists
    const existingMeeting = await Meeting.findOne({ title: 'Test Monthly Meeting - January 2025' });
    if (existingMeeting) {
      console.log('Test meeting already exists:', existingMeeting.title);
      return;
    }

    // Create a test meeting
    const testMeeting = await Meeting.create({
      title: 'Test Monthly Meeting - January 2025',
      description: 'This is a test meeting for debugging purposes',
      meetingType: 'monthly_series',
      scheduledDate: new Date('2025-01-15'),
      duration: 60,
      targetAudience: 'group_admins', // Visible to all group admins
      status: 'scheduled',
      monthlyDetails: {
        month: 1,
        year: 2025,
        synopsis: 'Test meeting for January 2025',
        totalSessions: 4
      },
      createdBy: creatorUser._id
    });

    console.log('Created test meeting:', testMeeting.title);

    // Create test sessions for the meeting
    const sessions = [
      { title: 'Session 1: Introduction', description: 'Opening session' },
      { title: 'Session 2: Discussion', description: 'Main discussion' },
      { title: 'Session 3: Planning', description: 'Future planning' },
      { title: 'Session 4: Conclusion', description: 'Closing session' }
    ];

    for (let i = 0; i < sessions.length; i++) {
      const sessionDate = new Date(2025, 0, 15 + i * 7); // Year, Month (0-based), Day
      const session = await MeetingSession.create({
        meeting: testMeeting._id,
        sessionNumber: i + 1,
        title: sessions[i].title,
        description: sessions[i].description,
        scheduledDate: sessionDate,
        duration: 60,
        createdBy: creatorUser._id
      });
      console.log(`Created session ${i + 1}:`, session.title);
    }

    // Check total meetings in database
    const totalMeetings = await Meeting.countDocuments();
    console.log(`\n✅ Total meetings in database: ${totalMeetings}`);

    // List all meetings
    const allMeetings = await Meeting.find({}).select('title targetAudience createdBy');
    console.log('\n📋 All meetings:');
    allMeetings.forEach(meeting => {
      console.log(`  - ${meeting.title} (${meeting.targetAudience})`);
    });

  } catch (error) {
    console.error('❌ Error creating test meeting:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
createTestMeeting();