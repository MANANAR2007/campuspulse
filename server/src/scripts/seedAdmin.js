import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

/**
 * Seed or update the initial Campus Administrator account.
 * Note: This script should ONLY be executed by the project administrator/owner.
 */
async function seedAdmin() {
  console.log('🏛️  CampusPulse Admin Provisioning Script');
  console.log('-----------------------------------------');

  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  // 1. Validate required environment variables
  const missing = [];
  if (!name) missing.push('ADMIN_NAME');
  if (!email) missing.push('ADMIN_EMAIL');
  if (!password) missing.push('ADMIN_PASSWORD');

  if (missing.length > 0) {
    console.error(`❌ Missing required admin environment variables in server/.env: ${missing.join(', ')}`);
    console.error('Please configure ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this script.');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('❌ ADMIN_PASSWORD must be at least 6 characters long.');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 2. Connect to database
    console.log('🔄 Connecting to MongoDB Atlas...');
    await connectDB();

    // 3. Hash admin password
    const passwordHash = await User.hashPassword(password);

    // 4. Create or update admin account
    const existingAdmin = await User.findOne({ email: normalizedEmail });

    if (existingAdmin) {
      existingAdmin.name = name.trim();
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log(`✅ Existing account [${normalizedEmail}] updated with administrator privileges.`);
    } else {
      await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'admin',
        department: 'Campus Administration',
      });
      console.log(`✅ New administrator account [${normalizedEmail}] successfully created.`);
    }

    console.log('🔒 Security Notice: The administrator account has been safely provisioned without logging credentials.');
    console.log('You may now sign in using the normal /login portal.');

    await mongoose.disconnect();
    console.log('Disconnected from database.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Admin Provisioning Failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

seedAdmin();
