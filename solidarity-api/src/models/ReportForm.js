import mongoose from 'mongoose';
import { REPORT_LEVELS } from '../services/monthlyReports/fields.js';

// The monthly report form for one level (state / district / area). `fields` is
// the working copy the state admin edits; publishing freezes it into a
// ReportFormVersion. Field definitions are validated by normaliseFormFields
// before saving, so they are stored as plain objects.
const reportFormSchema = new mongoose.Schema({
  level: { type: String, enum: REPORT_LEVELS, required: true, unique: true },
  title: { type: String, trim: true, maxlength: 200, default: '' },
  fields: { type: [mongoose.Schema.Types.Mixed], default: [] },
  // Next id handed to a new field. Only ever grows, so ids are never reused.
  nextFieldId: { type: Number, default: 1, min: 1 },
  // Last published version; 0 = never published (nobody can fill it yet).
  version: { type: Number, default: 0, min: 0 },
  hasUnpublishedChanges: { type: Boolean, default: false },
  // A month's report stays editable until this day of the following month (IST).
  deadlineDay: { type: Number, default: 10, min: 1, max: 28 },
  publishedAt: Date,
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, minimize: false });

export default mongoose.model('ReportForm', reportFormSchema);
