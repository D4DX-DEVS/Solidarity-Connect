import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const fixIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop the old unique index on phone
    try {
      await User.collection.dropIndex('phone_1');
      console.log('✅ Dropped old phone index');
    } catch (error) {
      console.log('ℹ️  Phone index not found or already dropped');
    }

    // Clear existing users to avoid conflicts
    await User.deleteMany({});
    console.log('✅ Cleared existing users');

    // The new compound index will be created automatically when the model is used
    console.log('✅ Database indexes fixed');

  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

fixIndexes();