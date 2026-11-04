require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { Roles } = require('../src/utils/roles');

const createAdmin = async () => {
  const { BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD } = process.env;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be set in SERVER/.env');
  }

  if (!BOOTSTRAP_ADMIN_NAME || !BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD) {
    throw new Error('Provide the admin name, email, and password through the bootstrap environment');
  }

  if (BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
    throw new Error('Admin password must be at least 12 characters');
  }

  const email = BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid admin email address');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  const existingSuperadmin = await User.exists({ role: Roles.SUPERADMIN, isActive: true });
  if (!existingSuperadmin) {
    throw new Error('Create an active superadmin account before creating admins');
  }

  const existingUser = await User.exists({ email });
  if (existingUser) {
    throw new Error('An account with that email already exists; choose a different email');
  }

  const password = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 12);
  await User.create({
    name: BOOTSTRAP_ADMIN_NAME.trim(),
    email,
    password,
    role: Roles.ADMIN,
    isActive: true,
  });

  console.log(`Admin account created for ${email}`);
};

createAdmin()
  .catch((error) => {
    console.error(`Admin setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
