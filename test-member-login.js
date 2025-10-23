// Test script for member login functionality
const API_BASE_URL = 'http://localhost:5003/api';

async function testMemberLogin() {
  console.log('🧪 Testing Member Login Flow');
  console.log('============================');

  const phone = '9656550933';
  
  try {
    // Step 1: Send OTP
    console.log('\n📱 Step 1: Sending OTP...');
    const otpResponse = await fetch(`${API_BASE_URL}/member-auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone }),
    });

    const otpData = await otpResponse.json();
    console.log('OTP Response:', otpData);

    if (!otpData.success) {
      throw new Error(otpData.message);
    }

    const demoOTP = otpData.data.demoOTP;
    console.log(`✅ OTP sent successfully! Demo OTP: ${demoOTP}`);

    // Step 2: Verify OTP
    console.log('\n🔐 Step 2: Verifying OTP...');
    const verifyResponse = await fetch(`${API_BASE_URL}/member-auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        phone, 
        otp: demoOTP || '1234' // Use demo OTP or fallback to 1234
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log('Verify Response:', verifyData);

    if (!verifyData.success) {
      throw new Error(verifyData.message);
    }

    const token = verifyData.data.token;
    const member = verifyData.data.member;
    console.log(`✅ Login successful! Member: ${member.name}`);

    // Step 3: Get Profile
    console.log('\n👤 Step 3: Getting member profile...');
    const profileResponse = await fetch(`${API_BASE_URL}/member-auth/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const profileData = await profileResponse.json();
    console.log('Profile Response:', profileData);

    if (!profileData.success) {
      throw new Error(profileData.message);
    }

    console.log(`✅ Profile retrieved successfully!`);
    console.log(`   Name: ${profileData.data.profile.name}`);
    console.log(`   Phone: ${profileData.data.profile.phone}`);
    console.log(`   District: ${profileData.data.profile.district.name}`);
    console.log(`   Group: ${profileData.data.profile.group.name}`);
    console.log(`   Status: ${profileData.data.profile.status}`);

    console.log('\n🎉 All tests passed! Member login is working correctly.');
    console.log('\n📋 Test Summary:');
    console.log(`   Phone: ${phone}`);
    console.log(`   Member: ${member.name}`);
    console.log(`   Token: ${token.substring(0, 20)}...`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
testMemberLogin();