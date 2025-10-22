import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const baithulMaalPaymentSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: [true, 'Member is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  paymentDate: {
    type: Date,
    required: [true, 'Payment date is required'],
    default: Date.now
  },
  paymentMonth: {
    type: String,
    required: [true, 'Payment month is required'],
    match: [/^\d{4}-\d{2}$/, 'Payment month must be in YYYY-MM format']
  },
  paymentType: {
    type: String,
    enum: ['monthly', 'arrears', 'advance', 'special'],
    default: 'monthly'
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  receiptNumber: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'other'],
    default: 'cash'
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recorded by is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
baithulMaalPaymentSchema.index({ member: 1, paymentMonth: 1 });
baithulMaalPaymentSchema.index({ paymentDate: -1 });
baithulMaalPaymentSchema.index({ member: 1, paymentDate: -1 });
baithulMaalPaymentSchema.index({ isActive: 1 });

// Compound index to prevent duplicate payments for same member and month
baithulMaalPaymentSchema.index(
  { member: 1, paymentMonth: 1, isActive: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// Virtual for formatted payment month
baithulMaalPaymentSchema.virtual('formattedPaymentMonth').get(function() {
  if (!this.paymentMonth) return '';
  const [year, month] = this.paymentMonth.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
});

// Static method to calculate total payments for a member
baithulMaalPaymentSchema.statics.calculateMemberTotal = async function(memberId) {
  const result = await this.aggregate([
    { 
      $match: { 
        member: new mongoose.Types.ObjectId(memberId),
        isActive: true 
      } 
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        paymentCount: { $sum: 1 },
        lastPaymentDate: { $max: '$paymentDate' }
      }
    }
  ]);

  return result[0] || { totalAmount: 0, paymentCount: 0, lastPaymentDate: null };
};

// Static method to get payment summary by month
baithulMaalPaymentSchema.statics.getPaymentSummary = async function(memberId, startDate, endDate) {
  const matchFilter = {
    member: new mongoose.Types.ObjectId(memberId),
    isActive: true
  };

  if (startDate || endDate) {
    matchFilter.paymentDate = {};
    if (startDate) matchFilter.paymentDate.$gte = new Date(startDate);
    if (endDate) matchFilter.paymentDate.$lte = new Date(endDate);
  }

  return await this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$paymentMonth',
        totalAmount: { $sum: '$amount' },
        paymentCount: { $sum: 1 },
        payments: { 
          $push: {
            _id: '$_id',
            amount: '$amount',
            paymentDate: '$paymentDate',
            paymentType: '$paymentType',
            description: '$description'
          }
        }
      }
    },
    { $sort: { _id: -1 } }
  ]);
};

// Method to update member's total paid amount
baithulMaalPaymentSchema.methods.updateMemberTotal = async function() {
  const Member = mongoose.model('Member');
  const total = await this.constructor.calculateMemberTotal(this.member);
  
  await Member.findByIdAndUpdate(this.member, {
    'baithulMaal.totalPaid': total.totalAmount,
    'baithulMaal.lastPaymentDate': total.lastPaymentDate
  });
};

// Pre-save middleware to update member totals
baithulMaalPaymentSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('amount') || this.isModified('isActive')) {
    // Update member total after save
    this.constructor.prototype.updateMemberTotalAfterSave = true;
  }
  next();
});

// Post-save middleware to update member totals
baithulMaalPaymentSchema.post('save', async function() {
  if (this.updateMemberTotalAfterSave) {
    await this.updateMemberTotal();
  }
});

// Post-remove middleware to update member totals
baithulMaalPaymentSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    await doc.updateMemberTotal();
  }
});

baithulMaalPaymentSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await doc.updateMemberTotal();
  }
});

// Add pagination plugin
baithulMaalPaymentSchema.plugin(mongoosePaginate);

const BaithulMaalPayment = mongoose.model('BaithulMaalPayment', baithulMaalPaymentSchema);

export default BaithulMaalPayment;