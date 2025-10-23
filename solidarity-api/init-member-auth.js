import dotenv from 'dotenv';
import connectDB from './src/config/database.js';
import { createMemberAuthRecords } from './src/utils/createMemberAuthRecords.js';

// Load environment variables
dotenv.config();

async function initializeMemberAuth() {
  try {
    console.log('🚀 Initializing Member Authentication System...');
    
    // Connect to database
    await connectDB();
    
    // Create member auth records
    const result = await createMemberAuthRecords();
    
    if (result.success) {
      console.log('✅ Member authentication system initialized successfully!');
      process.exit(0);
    } else {
      console.error('❌ Failed to initialize member authentication system:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeMemberAuth();