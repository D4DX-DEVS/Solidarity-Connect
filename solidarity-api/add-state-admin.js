import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const User = mongoose.connection.collection('users');

const phone = '9876543210';
const existing = await User.findOne({ phone });

if (existing) {
  await User.updateOne({ _id: existing._id }, { $set: { role: 'state_admin', isActive: true } });
  console.log('Updated existing record to state_admin:', existing.name);
} else {
  await User.insertOne({
    name: 'State Admin',
    phone,
    role: 'state_admin',
    isActive: true,
    permissions: [
      'manage_users', 'manage_members', 'manage_districts', 'manage_groups',
      'approve_transfers', 'send_notifications', 'view_reports', 'bulk_import',
      'manage_meetings', 'manage_baithul_maal'
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('Created state_admin: State Admin (9876543210)');
}

await mongoose.disconnect();
