require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { Roles } = require('../src/utils/roles');

const createSuperadmin = async () => {
  const { BOOTSTRAP_SUPERADMIN_NAME, BOOTSTRAP_SUPERADMIN_EMAIL, BOOTSTRAP_SUPERADMIN_PASSWORD } =
    process.env;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be set in SERVER/.env');
  }

  if (!BOOTSTRAP_SUPERADMIN_NAME || !BOOTSTRAP_SUPERADMIN_EMAIL || !BOOTSTRAP_SUPERADMIN_PASSWORD) {
    throw new Error('Provide the superadmin name, email, and password through the bootstrap environment');
  }

  if (BOOTSTRAP_SUPERADMIN_PASSWORD.length < 12) {
    throw new Error('Superadmin password must be at least 12 characters');
  }

  const email = BOOTSTRAP_SUPERADMIN_EMAIL.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid superadmin email address');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  const existingSuperadmin = await User.exists({ role: Roles.SUPERADMIN });
  if (existingSuperadmin) {
    throw new Error('A superadmin account already exists; refusing to create another');
  }

  const existingUser = await User.exists({ email });
  if (existingUser) {
    throw new Error('An account with that email already exists; choose a different email');
  }

  const password = await bcrypt.hash(BOOTSTRAP_SUPERADMIN_PASSWORD, 12);
  await User.create({
    name: BOOTSTRAP_SUPERADMIN_NAME.trim(),
    email,
    password,
    role: Roles.SUPERADMIN,
    isActive: true,
  });

  console.log(`Superadmin account created for ${email}`);
};

createSuperadmin()
  .catch((error) => {
    console.error(`Superadmin setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
