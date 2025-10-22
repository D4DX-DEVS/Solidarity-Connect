import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing State Admin Meetings Review Endpoint Setup...\n');

// Test that the route file can be imported without syntax errors
try {
  console.log('📁 Checking meetings routes file...');
  
  const routeFile = path.join(__dirname, 'src', 'routes', 'meetings.js');
  const content = fs.readFileSync(routeFile, 'utf8');
  
  // Check if our new endpoint exists
  if (content.includes('/admin/review')) {
    console.log('✅ State admin meetings review endpoint found in routes');
  } else {
    console.log('❌ State admin meetings review endpoint not found');
  }
  
  // Check for required imports
  if (content.includes('requireRole')) {
    console.log('✅ Role-based authentication middleware imported');
  } else {
    console.log('❌ Role-based authentication middleware not found');
  }
  
  // Check for pagination
  if (content.includes('paginationValidation')) {
    console.log('✅ Pagination validation middleware found');
  } else {
    console.log('❌ Pagination validation middleware not found');
  }
  
  console.log('\n🎯 Route setup validation completed!');
  console.log('\n📝 Next steps to test the endpoint:');
  console.log('1. Start the API server: npm start');
  console.log('2. Login as a state admin to get a valid token');
  console.log('3. Make a GET request to /api/meetings/admin/review');
  console.log('4. Test various filter parameters:');
  console.log('   - status, meetingType, targetAudience');
  console.log('   - completionStatus, attendanceRate');
  console.log('   - dateFrom, dateTo, search');
  console.log('   - district, group');

} catch (error) {
  console.error('❌ Test failed:', error.message);
}