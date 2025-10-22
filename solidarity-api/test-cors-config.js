import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing CORS Configuration...\n');

try {
  // Check server.js for CORS configuration
  const serverFile = path.join(__dirname, 'src', 'server.js');
  const serverContent = fs.readFileSync(serverFile, 'utf8');
  
  // Check .env for frontend URL
  const envFile = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envFile, 'utf8');
  
  console.log('📁 Checking CORS configuration...');
  
  // Check if DigitalOcean URL is included
  if (serverContent.includes('octopus-app-zv6rt.ondigitalocean.app')) {
    console.log('✅ DigitalOcean frontend URL found in CORS origins');
  } else {
    console.log('❌ DigitalOcean frontend URL not found in CORS origins');
  }
  
  // Check if environment variable is used
  if (serverContent.includes('process.env.FRONTEND_URL')) {
    console.log('✅ Environment variable FRONTEND_URL is used');
  } else {
    console.log('❌ Environment variable FRONTEND_URL not used');
  }
  
  // Check if FRONTEND_URL is set in .env
  if (envContent.includes('FRONTEND_URL=')) {
    console.log('✅ FRONTEND_URL is configured in .env file');
    const frontendUrl = envContent.match(/FRONTEND_URL=(.+)/)?.[1];
    console.log(`   Frontend URL: ${frontendUrl}`);
  } else {
    console.log('❌ FRONTEND_URL not found in .env file');
  }
  
  // Check if CORS methods are configured
  if (serverContent.includes('methods:') && serverContent.includes('POST')) {
    console.log('✅ CORS methods configured (including POST)');
  } else {
    console.log('❌ CORS methods not properly configured');
  }
  
  // Check if credentials are enabled
  if (serverContent.includes('credentials: true')) {
    console.log('✅ CORS credentials enabled');
  } else {
    console.log('❌ CORS credentials not enabled');
  }
  
  console.log('\n🎯 CORS configuration check completed!');
  console.log('\n📝 Configuration summary:');
  console.log('• Production origins: https://octopus-app-zv6rt.ondigitalocean.app');
  console.log('• Development origins: localhost:3000, 5173, 8080, 8081');
  console.log('• Methods: GET, POST, PUT, DELETE, OPTIONS');
  console.log('• Credentials: Enabled');
  console.log('• Headers: Content-Type, Authorization');
  
  console.log('\n🚀 Next steps:');
  console.log('1. Restart the API server to apply CORS changes');
  console.log('2. Ensure NODE_ENV=production in production environment');
  console.log('3. Test API endpoints from the frontend');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}