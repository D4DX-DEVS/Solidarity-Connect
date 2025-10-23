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
      console.log('No state admin found. Please create a state admin user first.');
      return;
    }

    console.log(`Creating test meetings with user: ${stateAdmin.name}`);

    // Create a general meeting for all group admins
    const generalMeeting = await Meeting.create({
      title: 'Monthly General Meeting - January 2025',
      description: 'General meeting for all group administrators to discuss monthly activities and updates',
      meetingType: 'general',
      targetAudience: 'group_admins',
      scheduledDate: new Date('2025-01-15T10:00:00Z'),
      status: 'scheduled',
      createdBy: stateAdmin._id
    });

    console.log(`✅ Created general meeting: ${generalMeeting.title}`);

    // Create a monthly series meeting
    const monthlySeriesMeeting = await Meeting.create({
      title: 'Monthly Series - February 2025',
      description: 'Monthly series meeting with multiple sessions',
      meetingType: 'monthly_series',
      targetAudience: 'all',
      scheduledDate: new Date('2025-02-01T10:00:00Z'),
      status: 'scheduled',
      createdBy: stateAdmin._id,
      monthlyDetails: {
        month: 2,
        year: 2025,
        totalSessions: 4
      }
    });

    console.log(`✅ Created monthly series meeting: ${monthlySeriesMeeting.title}`);

    // Create sessions for the monthly series meeting
    const sessions = [
      {
        sessionNumber: 1,
        title: 'Session 1: Introduction and Planning',
        scheduledDate: new Date('2025-02-01T10:00:00Z'),
        duration: 60,
        meeting: monthlySeriesMeeting._id,
        sessionStatus: 'scheduled'
      },
      {
        sessionNumber: 2,
        title: 'Session 2: Implementation Discussion',
        scheduledDate: new Date('2025-02-08T10:00:00Z'),
        duration: 60,
        meeting: monthlySeriesMeeting._id,
        sessionStatus: 'scheduled'
      },
      {
        sessionNumber: 3,
        title: 'Session 3: Progress Review',
        scheduledDate: new Date('2025-02-15T10:00:00Z'),
        duration: 60,
        meeting: monthlySeriesMeeting._id,
        sessionStatus: 'scheduled'
      },
      {
        sessionNumber: 4,
        title: 'Session 4: Final Review and Next Steps',
        scheduledDate: new Date('2025-02-22T10:00:00Z'),
        duration: 60,
        meeting: monthlySeriesMeeting._id,
        sessionStatus: 'scheduled'
      }
    ];

    await MeetingSession.insertMany(sessions);
    console.log(`✅ Created ${sessions.length} sessions for monthly series meeting`);

    console.log('\n🎉 Test meetings created successfully!');
    console.log('You can now test the meetings API');

  } catch (error) {
    console.error('❌ Error creating test meetings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
createTestMeetings();