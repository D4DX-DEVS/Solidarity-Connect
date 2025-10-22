import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Group code is required'],
    uppercase: true,
    trim: true,
    maxlength: [10, 'Group code cannot exceed 10 characters']
  },
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District',
    required: [true, 'District is required']
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  meetingSchedule: {
    day: {
      type: String,
      enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    time: String,
    venue: String
  },
  contactInfo: {
    phone: String,
    email: String,
    address: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  statistics: {
    totalMembers: {
      type: Number,
      default: 0
    },
    activeMembers: {
      type: Number,
      default: 0
    },
    totalBaithulMaal: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for unique group code within district
groupSchema.index({ code: 1, district: 1 }, { unique: true });
groupSchema.index({ name: 1 });
groupSchema.index({ district: 1 });
groupSchema.index({ isActive: 1 });

// Virtual for members in this group
groupSchema.virtual('members', {
  ref: 'Member',
  localField: '_id',
  foreignField: 'group'
});

// Method to update statistics
groupSchema.methods.updateStatistics = async function() {
  const Member = mongoose.model('Member');
  
  const totalMembers = await Member.countDocuments({ group: this._id });
  const activeMembers = await Member.countDocuments({ 
    group: this._id, 
    status: 'Active', 
    isApproved: true 
  });
  
  // Calculate total Baithul Maal
  const baithulMaalResult = await Member.aggregate([
    { $match: { group: this._id, status: 'Active', isApproved: true } },
    {
      $group: {
        _id: null,
        totalMonthly: { $sum: '$baithulMaal.monthlyAmount' },
        totalPaid: { $sum: '$baithulMaal.totalPaid' }
      }
    }
  ]);
  
  const totalBaithulMaal = baithulMaalResult.length > 0 ? baithulMaalResult[0].totalMonthly : 0;
  
  this.statistics = {
    totalMembers,
    activeMembers,
    totalBaithulMaal
  };
  
  return this.save();
};

// Static method to get groups with statistics
groupSchema.statics.findWithStats = function(filter = {}) {
  return this.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'members',
        localField: '_id',
        foreignField: 'group',
        as: 'membersList'
      }
    },
    {
      $lookup: {
        from: 'districts',
        localField: 'district',
        foreignField: '_id',
        as: 'districtInfo'
      }
    },
    {
      $addFields: {
        'statistics.totalMembers': { $size: '$membersList' },
        'statistics.activeMembers': {
          $size: {
            $filter: {
              input: '$membersList',
              cond: { 
                $and: [
                  { $eq: ['$$this.status', 'Active'] },
                  { $eq: ['$$this.isApproved', true] }
                ]
              }
            }
          }
        },
        'statistics.totalBaithulMaal': {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$membersList',
                  cond: { 
                    $and: [
                      { $eq: ['$$this.status', 'Active'] },
                      { $eq: ['$$this.isApproved', true] }
                    ]
                  }
                }
              },
              as: 'member',
              in: '$$member.baithulMaal.monthlyAmount'
            }
          }
        },
        district: { $arrayElemAt: ['$districtInfo', 0] }
      }
    },
    {
      $project: {
        membersList: 0,
        districtInfo: 0
      }
    }
  ]);
};

// Static method to find groups by district
groupSchema.statics.findByDistrict = function(districtId) {
  return this.find({ district: districtId, isActive: true })
    .populate('district', 'name code')
    .populate('admin', 'name phone email');
};

// Add pagination plugin
groupSchema.plugin(mongoosePaginate);

export default mongoose.model('Group', groupSchema);