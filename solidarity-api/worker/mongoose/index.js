// Mongoose-compatible ODM backed by Cloudflare D1. Aliased as "mongoose" in the
// Worker bundle so the existing models and routes run unchanged.
import { ObjectId } from './objectid.js';
import { Schema, SchemaTypes } from './schema.js';
import { CastError, ValidationError, ValidatorError } from './cast.js';
import { createModel, models, Query, Aggregate, Document, ddlFor } from './model.js';
import { MongoServerError, setDatabase } from './store.js';

const noop = () => {};

const session = () => ({
  async withTransaction(fn) {
    return fn(this);
  },
  startTransaction: noop,
  async commitTransaction() {},
  async abortTransaction() {},
  async endSession() {},
  inTransaction: () => false,
});

export const connection = {
  readyState: 1,
  host: 'cloudflare-d1',
  name: 'd1',
  db: { databaseName: 'd1' },
  models,
  on: noop,
  once: noop,
  off: noop,
  async close() {},
  /** No multi-statement transactions over HTTP D1: runs the callback directly. */
  async transaction(fn) {
    return fn(undefined);
  },
  async startSession() {
    return session();
  },
};

class MongooseError extends Error {}
MongooseError.CastError = CastError;
MongooseError.ValidationError = ValidationError;
MongooseError.ValidatorError = ValidatorError;

export function model(name, schema, collection) {
  if (schema === undefined) {
    if (!models[name]) {
      const err = new Error(`Schema hasn't been registered for model "${name}".\nUse mongoose.model(name, schema)`);
      err.name = 'MissingSchemaError';
      throw err;
    }
    return models[name];
  }
  if (!(schema instanceof Schema)) schema = new Schema(schema);
  return createModel(name, schema, typeof collection === 'string' ? collection : undefined);
}

export const Types = { ObjectId };
export const isValidObjectId = (v) => {
  if (v === null || v === undefined) return false;
  if (v instanceof ObjectId) return true;
  if (typeof v === 'string') return /^[0-9a-fA-F]{24}$/.test(v) || v.length === 12;
  if (typeof v === 'number') return true;
  if (typeof v === 'object' && v._id !== undefined) return isValidObjectId(v._id);
  return ObjectId.isValid(v);
};
export const isObjectIdOrHexString = (v) => v instanceof ObjectId || (typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v));

const mongoose = {
  Schema,
  SchemaTypes,
  Types,
  ObjectId,
  model,
  models,
  connection,
  connections: [connection],
  Query,
  Aggregate,
  Document,
  Error: MongooseError,
  MongooseError,
  CastError,
  MongoServerError,
  isValidObjectId,
  isObjectIdOrHexString,
  async connect() {
    return mongoose;
  },
  async disconnect() {},
  set: noop,
  get: noop,
  plugin: noop,
  async startSession() {
    return session();
  },
  deleteModel(name) {
    delete models[name];
  },
  modelNames: () => Object.keys(models),
  setDatabase,
  ddlFor,
  version: '7.6.3-d1',
};

export { Schema, SchemaTypes, ObjectId, Query, Aggregate, Document, CastError, ValidationError, setDatabase, ddlFor };
export default mongoose;
