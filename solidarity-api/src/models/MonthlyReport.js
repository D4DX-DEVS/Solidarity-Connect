import mongoose from 'mongoose';
import { REPORT_LEVELS } from '../services/monthlyReports/fields.js';

// One shared report per scope per month: the state, a district, or an area.
// Any admin of that scope may fill or edit it; `history` records who did what.
//
// A document can exist without `submittedAt` when a higher level unlocked a
// month nobody had submitted yet — that still counts as "not submitted".
const historySchema = new mongoose.Schema({
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
  action: { type: String, enum: ['submitted', 'edited', 'unlocked'], required: true },
  // Field ids whose answers changed in this save.
  changed: { type: [Number], default: [] },
}, { _id: false });

const monthlyReportSchema = new mongoose.Schema({
  level: { type: String, enum: REPORT_LEVELS, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  // 'state' | 'district:<districtId>' | 'area:<groupId>'
  scopeKey: { type: String, required: true },
  district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
  area: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },

  formVersion: { type: Number, min: 1 },
  // Keyed `f<fieldId>`; validated by validateAnswers before every save.
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Add-up number answers, kept apart so totals are a simple sum.
  numbers: [{ _id: false, fieldId: Number, value: Number }],

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date, default: null },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastEditedAt: Date,
  history: { type: [historySchema], default: [] },

  unlockedUntil: Date,
  unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, minimize: false });

monthlyReportSchema.index({ scopeKey: 1, year: 1, month: 1 }, { unique: true });
monthlyReportSchema.index({ year: 1, month: 1, level: 1 });
monthlyReportSchema.index({ district: 1, year: 1, month: 1 });

export default mongoose.model('MonthlyReport', monthlyReportSchema);
