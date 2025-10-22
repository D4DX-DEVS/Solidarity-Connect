import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const districtSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'District name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'District name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'District code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [10, 'District code cannot exceed 10 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    default: 'Kerala',
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  contactInfo: {
    phone: String,
    email: String,
    address: String
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
    totalGroups: {
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

// Indexes
districtSchema.index({ name: 1 });
districtSchema.index({ code: 1 });
districtSchema.index({ isActive: 1 });

// Virtual for groups in this district
districtSchema.virtual('groups', {
  ref: 'Group',
  localField: '_id',
  foreignField: 'district'
});

// Virtual for members in this district
districtSchema.virtual('members', {
  ref: 'Member',
  localField: '_id',
  foreignField: 'district'
});

// Method to update statistics
districtSchema.methods.updateStatistics = async function() {
  const Member = mongoose.model('Member');
  const Group = mongoose.model('Group');
  
  const totalMembers = await Member.countDocuments({ district: this._id });
  const activeMembers = await Member.countDocuments({ 
    district: this._id, 
    status: 'Active', 
    isApproved: true 
  });
  const totalGroups = await Group.countDocuments({ district: this._id, isActive: true });
  
  this.statistics = {
    totalMembers,
    activeMembers,
    totalGroups
  };
  
  return this.save();
};

// Static method to get district with statistics
districtSchema.statics.findWithStats = function(filter = {}) {
  return this.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'members',
        localField: '_id',
        foreignField: 'district',
        as: 'membersList'
      }
    },
    {
      $lookup: {
        from: 'groups',
        localField: '_id',
        foreignField: 'district',
        as: 'groupsList'
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
        'statistics.totalGroups': {
          $size: {
            $filter: {
              input: '$groupsList',
              cond: { $eq: ['$$this.isActive', true] }
            }
          }
        }
      }
    },
    {
      $project: {
        membersList: 0,
        groupsList: 0
      }
    }
  ]);
};

// Add pagination plugin
districtSchema.plugin(mongoosePaginate);

export default mongoose.model('District', districtSchema);