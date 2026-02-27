import mongoose from 'mongoose';

const orgFileSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'File title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: ['constitution', 'guidelines', 'video', 'audio', 'document', 'other'],
    default: 'document'
  },
  // 'general' = visible to all authenticated users
  // 'membership_form' = visible to group_admin (all types) and state_admin
  fileType: {
    type: String,
    enum: ['general', 'membership_form'],
    default: 'general'
  },
  url: {
    type: String,
    required: [true, 'File URL is required']
  },
  filename: {
    type: String,
    required: [true, 'Filename is required']
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

orgFileSchema.index({ category: 1 });
orgFileSchema.index({ fileType: 1 });
orgFileSchema.index({ isActive: 1 });
orgFileSchema.index({ uploadedBy: 1 });

const OrgFile = mongoose.model('OrgFile', orgFileSchema);

export default OrgFile;
