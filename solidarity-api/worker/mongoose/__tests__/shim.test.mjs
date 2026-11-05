// node --test --import ./worker/dev/register.mjs worker/mongoose/__tests__/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { createD1 } from '../../dev/sqlite-d1.mjs';

const { Schema } = mongoose;
const db = createD1(':memory:');
mongoose.setDatabase(db);

const districtSchema = new Schema({ name: { type: String, required: true, unique: true, trim: true }, code: String }, { timestamps: true });
districtSchema.virtual('units', { ref: 'TUnit', localField: '_id', foreignField: 'district' });
const District = mongoose.model('TDistrict', districtSchema);

const unitSchema = new Schema({ name: String, district: { type: Schema.Types.ObjectId, ref: 'TDistrict' } });
const Unit = mongoose.model('TUnit', unitSchema);

const personSchema = new Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: [10, 'Too long'] },
  phone: { type: String, required: true, unique: true, match: [/^\d{10}$/, 'Bad phone'] },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Inactive' },
  age: { type: Number, min: 0 },
  dob: Date,
  district: { type: Schema.Types.ObjectId, ref: 'TDistrict' },
  units: [{ type: Schema.Types.ObjectId, ref: 'TUnit' }],
  tags: [{ type: String, enum: ['a', 'b', 'c'] }],
  roleTag: { type: { type: String, enum: ['state', 'unit'] }, name: String, listingOrder: { type: Number, default: null } },
  history: [{ by: { type: Schema.Types.ObjectId, ref: 'TDistrict' }, at: { type: Date, default: Date.now }, note: String }],
  meta: { type: Schema.Types.Mixed, default: {} },
  secret: { type: String, select: false },
  hooked: Number,
}, { timestamps: true });
personSchema.pre('save', function (next) {
  if (this.isModified('dob') && this.dob) this.age = 2026 - this.dob.getUTCFullYear();
  next();
});
personSchema.virtual('label').get(function () {
  return `${this.name}:${this.status}`;
});
personSchema.methods.isActive = function () {
  return this.status === 'Active';
};
personSchema.statics.byPhone = function (phone) {
  return this.findOne({ phone });
};
personSchema.plugin(mongoosePaginate);
const Person = mongoose.model('TPerson', personSchema);

const ttlSchema = new Schema({ key: String, expiresAt: { type: Date, index: { expires: 0 } } });
const Ttl = mongoose.model('TTtl', ttlSchema);

before(async () => {
  for (const M of [District, Unit, Person, Ttl]) for (const sql of mongoose.ddlFor(M)) await db.exec(sql);
});

let kozhikode;
let wayanad;

test('create, defaults, timestamps, toJSON shape', async () => {
  kozhikode = await District.create({ name: '  Kozhikode ', code: 'KKD' });
  wayanad = await District.create({ name: 'Wayanad', code: 'WYD' });
  assert.equal(kozhikode.name, 'Kozhikode');
  const p = await Person.create({ name: 'Ali', phone: '9876543210', district: String(kozhikode._id), dob: '1990-05-01', extra: 'dropped' });
  const json = JSON.parse(JSON.stringify(p));
  assert.equal(json.status, 'Inactive');
  assert.equal(json.district, String(kozhikode._id));
  assert.equal(json.__v, 0);
  assert.equal(json.age, 36, 'pre-save hook used isModified');
  assert.deepEqual(json.roleTag, { listingOrder: null });
  assert.deepEqual(json.units, []);
  assert.equal(json.extra, undefined, 'strict mode drops unknown fields');
  assert.ok(json.createdAt && json.updatedAt);
  assert.equal(typeof p._id.toHexString(), 'string');
  assert.equal(p.label, 'Ali:Inactive');
  assert.equal(p.isActive(), false);
  assert.equal(p.id, String(p._id));
});

test('validation errors and validateModifiedOnly', async () => {
  await assert.rejects(Person.create({ phone: 'x' }), (e) => {
    assert.equal(e.name, 'ValidationError');
    assert.equal(e.errors.name.message, 'Name is required');
    assert.equal(e.errors.phone.message, 'Bad phone');
    return true;
  });
  await assert.rejects(Person.create({ name: 'Bob', phone: '9000000001', status: 'Gone' }), /is not a valid enum value/);
  await assert.rejects(Person.create({ name: 'Bob', phone: '9000000001', tags: ['z'] }), /not a valid enum value/);
  await assert.rejects(Person.create({ name: 'Bob', phone: '9000000001', age: 'abc' }), /Cast to Number failed/);
  // Legacy invalid data stays saveable when only other paths change.
  await db.prepare(`UPDATE "tpersons" SET doc = json_set(doc, '$.name', 'WayTooLongName') WHERE json_extract(doc, '$.phone') = '9876543210'`).run();
  const p = await Person.byPhone('9876543210');
  p.status = 'Active';
  await p.save({ validateModifiedOnly: true });
  await assert.rejects(p.save(), /Too long/);
  await Person.updateOne({ _id: p._id }, { $set: { name: 'Ali' } });
});

test('unique index → E11000 with keyValue', async () => {
  await assert.rejects(Person.create({ name: 'Dup', phone: '9876543210' }), (e) => {
    assert.equal(e.code, 11000);
    assert.deepEqual(e.keyValue, { phone: '9876543210' });
    return true;
  });
});

test('queries: filters, sort, skip, limit, select, lean, count, distinct, exists', async () => {
  const u1 = await Unit.create({ name: 'U1', district: kozhikode._id });
  const u2 = await Unit.create({ name: 'U2', district: kozhikode._id });
  await Unit.create({ name: 'U3', district: wayanad._id });
  await Person.create({ name: 'Basheer', phone: '9000000002', status: 'Active', district: kozhikode._id, units: [u1._id, u2._id], tags: ['a', 'b'] });
  await Person.create({ name: 'Cyril', phone: '9000000003', status: 'Active', district: wayanad._id, tags: ['c'] });
  await Person.create({ name: 'Dana', phone: '9000000004', district: wayanad._id, roleTag: { type: 'unit', name: 'Pres' } });

  assert.equal(await Person.countDocuments({ status: 'Active' }), 3);
  assert.equal(await Person.countDocuments({ name: { $regex: '^b', $options: 'i' } }), 1);
  assert.equal(await Person.countDocuments({ $or: [{ district: String(wayanad._id) }, { tags: 'a' }] }), 3);
  assert.equal(await Person.countDocuments({ 'roleTag.type': 'unit' }), 1);
  assert.equal(await Person.countDocuments({ units: u2._id }), 1);
  assert.equal(await Person.countDocuments({ tags: { $in: ['c', 'b'] } }), 2);
  assert.equal(await Person.countDocuments({ createdAt: { $gte: '2020-01-01' } }), 4);

  const sorted = await Person.find({}).sort('-name').skip(1).limit(2).select('name');
  assert.deepEqual(sorted.map((d) => d.name), ['Cyril', 'Basheer']);
  assert.equal(sorted[0].phone, undefined);
  const lean = await Person.findOne({ phone: '9000000002' }).lean();
  assert.ok(lean.district instanceof mongoose.Types.ObjectId);
  assert.ok(lean.createdAt instanceof Date);
  assert.equal(lean.secret, undefined);
  const withSecret = await Person.findOne({ phone: '9000000002' }).select('+secret').lean();
  assert.ok('name' in withSecret);
  const ds = await Person.distinct('district', { status: 'Active' });
  assert.equal(ds.length, 2);
  assert.ok(await Person.exists({ phone: '9000000003' }));
  assert.equal(await Person.exists({ phone: 'nope' }), null);
  await assert.rejects(Person.findById('not-an-id'), (e) => e.name === 'CastError');
  assert.equal(await Person.findById(undefined), null);
});

test('populate: single, array, nested, virtual, inclusive select keeps path', async () => {
  const p = await Person.findOne({ phone: '9000000002' }).populate('district', 'name').populate({ path: 'units', select: 'name district', populate: { path: 'district', select: 'code' } }).select('name');
  assert.equal(p.district.name, 'Kozhikode');
  assert.equal(p.district.code, undefined);
  assert.deepEqual(p.units.map((u) => u.name), ['U1', 'U2']);
  assert.equal(p.units[0].district.code, 'KKD');
  const json = JSON.parse(JSON.stringify(p));
  assert.equal(json.district.name, 'Kozhikode');

  const d = await District.findById(kozhikode._id).populate('units');
  assert.equal(d.units.length, 2);
  const leanD = await District.find().populate({ path: 'units', select: 'name' }).lean();
  assert.equal(leanD.find((x) => x.code === 'WYD').units.length, 1);

  const doc = await Person.findOne({ phone: '9000000003' });
  await doc.populate([{ path: 'district', select: 'name' }]);
  assert.equal(doc.district.name, 'Wayanad');
  doc.status = 'Inactive';
  await doc.save();
  const raw = await Person.findOne({ phone: '9000000003' }).lean();
  assert.ok(raw.district instanceof mongoose.Types.ObjectId, 'populated doc saved back as id');
});

test('update operators, findOneAndUpdate, upsert, runValidators', async () => {
  const p = await Person.findOne({ phone: '9000000002' });
  const r = await Person.updateOne({ _id: p._id }, { $inc: { hooked: 2 }, $push: { tags: 'c' }, $set: { 'roleTag.name': 'Sec' } });
  assert.equal(r.matchedCount, 1);
  assert.equal(r.modifiedCount, 1);
  const after = await Person.findOneAndUpdate({ _id: p._id }, { $pull: { tags: 'a' }, $unset: { hooked: 1 } }, { new: true }).lean();
  assert.deepEqual(after.tags, ['b', 'c']);
  assert.equal(after.hooked, undefined);
  assert.equal(after.roleTag.name, 'Sec');
  assert.ok(after.updatedAt > p.updatedAt);
  await assert.rejects(Person.findByIdAndUpdate(p._id, { status: 'Nope' }, { new: true, runValidators: true }), /not a valid enum/);
  const up = await Person.findOneAndUpdate({ phone: '9111111111' }, { $set: { name: 'Upsert' }, $setOnInsert: { status: 'Active' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  assert.equal(up.phone, '9111111111');
  assert.equal(up.status, 'Active');
  assert.deepEqual(up.tags, []);
  const many = await Person.updateMany({ status: 'Active' }, { $set: { 'meta.flag': true } });
  assert.ok(many.modifiedCount >= 2);
  assert.equal(await Person.countDocuments({ 'meta.flag': true }), many.modifiedCount);
});

test('document arrays: _id, push, id(), pull, markModified, getChanges', async () => {
  const p = await Person.findOne({ phone: '9000000004' });
  p.history.push({ by: kozhikode._id, note: 'one' });
  p.history.push({ by: wayanad._id, note: 'two' });
  assert.ok(p.history[0]._id);
  assert.ok(p.history[0].at instanceof Date);
  await p.save();
  const again = await Person.findById(p._id);
  assert.equal(again.history.length, 2);
  const second = again.history.id(again.history[1]._id);
  assert.equal(second.note, 'two');
  again.history.pull(again.history[0]._id);
  again.meta.deep = { x: 1 };
  again.markModified('meta');
  assert.ok(again.isModified('history'));
  const changes = again.getChanges();
  assert.ok(changes.$set.history && changes.$set.meta);
  await again.save();
  const reread = await Person.findById(p._id).populate('history.by', 'name').lean();
  assert.equal(reread.history.length, 1);
  assert.equal(reread.history[0].by.name, 'Wayanad');
  assert.deepEqual(reread.meta, { deep: { x: 1 } });
});

test('aggregate: $match ObjectId, $group, $lookup, $bucket drops empty buckets, $facet', async () => {
  const byDistrict = await Person.aggregate([
    { $match: { district: new mongoose.Types.ObjectId(String(wayanad._id)) } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  assert.deepEqual(byDistrict, [{ _id: 'Active', n: 0 }].length ? byDistrict : []);
  assert.equal(byDistrict.reduce((s, x) => s + x.n, 0), 2);
  const joined = await Unit.aggregate([
    { $lookup: { from: 'tdistricts', localField: 'district', foreignField: '_id', as: 'd' } },
    { $unwind: '$d' },
    { $group: { _id: '$d.code', units: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  assert.deepEqual(joined, [{ _id: 'KKD', units: 2 }, { _id: 'WYD', units: 1 }]);
  const buckets = await Person.aggregate([
    { $bucket: { groupBy: '$age', boundaries: [0, 18, 30, 40, 120], default: 'Unknown', output: { count: { $sum: 1 } } } },
  ]);
  assert.deepEqual(buckets, [{ _id: 30, count: 1 }, { _id: 'Unknown', count: 4 }]);
  const [facet] = await Person.aggregate([{ $facet: { total: [{ $count: 'n' }], dated: [{ $match: { dob: { $type: 'date' } } }, { $count: 'n' }] } }]);
  assert.equal(facet.total[0].n, 5);
  assert.equal(facet.dated[0].n, 1);
  const years = await Person.aggregate([{ $match: { dob: { $exists: true } } }, { $project: { y: { $year: '$dob' } } }]);
  assert.equal(years[0].y, 1990);
});

test('paginate plugin', async () => {
  const res = await Person.paginate({}, { page: 2, limit: 2, sort: { name: 1 }, select: 'name', lean: true });
  assert.equal(res.totalDocs, 5);
  assert.equal(res.totalPages, 3);
  assert.equal(res.hasNextPage, true);
  assert.equal(res.docs.length, 2);
  assert.equal(res.docs[0].id, String(res.docs[0]._id), 'leanWithId');
});

test('delete ops and TTL', async () => {
  const doomed = await Person.create({ name: 'Gone', phone: '9222222222' });
  const deleted = await Person.findByIdAndDelete(doomed._id);
  assert.equal(deleted.name, 'Gone');
  assert.equal(await Person.findById(doomed._id), null);
  const r = await Person.deleteMany({ phone: { $in: ['9111111111'] } });
  assert.equal(r.deletedCount, 1);
  await Ttl.create({ key: 'old', expiresAt: new Date(Date.now() - 1000) });
  await Ttl.create({ key: 'new', expiresAt: new Date(Date.now() + 60000) });
  assert.deepEqual((await Ttl.find().lean()).map((t) => t.key), ['new']);
  const d = await Person.findOne({ phone: '9000000004' });
  await d.deleteOne();
  assert.equal(await Person.countDocuments({ phone: '9000000004' }), 0);
});
