import mongoose from 'mongoose';
import { REPORT_LEVELS } from '../services/monthlyReports/fields.js';

// A published report form, frozen. Each MonthlyReport points at the version it
// was filled on, so later edits to the form never relabel old answers.
const reportFormVersionSchema = new mongoose.Schema({
  level: { type: String, enum: REPORT_LEVELS, required: true },
  version: { type: Number, required: true, min: 1 },
  title: { type: String, default: '' },
  fields: { type: [mongoose.Schema.Types.Mixed], default: [] },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, minimize: false });

reportFormVersionSchema.index({ level: 1, version: 1 }, { unique: true });

export default mongoose.model('ReportFormVersion', reportFormVersionSchema);
