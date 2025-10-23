import Member from '../models/Member.js';
import MemberAuth from '../models/MemberAuth.js';

/**
 * Create member auth records for all active and approved members
 * This should be run once to initialize the member authentication system
 */
export async function createMemberAuthRecords() {
  try {
    console.log('🔄 Creating member auth records...');

    // Get all active and approved members
    const activeMembers = await Member.find({
      status: 'Active',
      isApproved: true
    });

    console.log(`📊 Found ${activeMembers.length} active members`);

    let created = 0;
    let skipped = 0;

    for (const member of activeMembers) {
      try {
        // Check if auth record already exists
        const existingAuth = await MemberAuth.findOne({ member: member._id });
        
        if (existingAuth) {
          skipped++;
          continue;
        }

        // Create new auth record
        const memberAuth = new MemberAuth({
          member: member._id,
          phone: member.phone,
          isActive: true
        });

        await memberAuth.save();
        created++;

      } catch (error) {
        console.error(`❌ Error creating auth record for member ${member.name} (${member.phone}):`, error.message);
      }
    }

    console.log(`✅ Member auth records creation completed:`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Skipped (already exists): ${skipped}`);
    console.log(`   - Total processed: ${activeMembers.length}`);

    return {
      success: true,
      created,
      skipped,
      total: activeMembers.length
    };

  } catch (error) {
    console.error('❌ Error creating member auth records:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create auth record for a specific member
 */
export async function createMemberAuthRecord(memberId) {
  try {
    const member = await Member.findById(memberId);
    
    if (!member) {
      throw new Error('Member not found');
    }

    if (member.status !== 'Active' || !member.isApproved) {
      throw new Error('Member is not active or approved');
    }

    // Check if auth record already exists
    const existingAuth = await MemberAuth.findOne({ member: memberId });
    if (existingAuth) {
      return existingAuth;
    }

    // Create new auth record
    const memberAuth = new MemberAuth({
      member: memberId,
      phone: member.phone,
      isActive: true
    });

    await memberAuth.save();
    return memberAuth;

  } catch (error) {
    console.error('Error creating member auth record:', error);
    throw error;
  }
}

/**
 * Update member auth record when member status changes
 */
export async function updateMemberAuthStatus(memberId, isActive) {
  try {
    const memberAuth = await MemberAuth.findOne({ member: memberId });
    
    if (memberAuth) {
      memberAuth.isActive = isActive;
      await memberAuth.save();
    }

    return memberAuth;

  } catch (error) {
    console.error('Error updating member auth status:', error);
    throw error;
  }
}