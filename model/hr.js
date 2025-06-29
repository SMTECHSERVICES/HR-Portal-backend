import mongoose from "mongoose";
import bcrypt from 'bcryptjs';

const hrSchema = new mongoose.Schema({
 
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
 
  password: {
    type: String,
    required: true
  },
}, {
  timestamps: true
});

// Password hashing middleware
hrSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Compare entered password with hashed password
hrSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const HR = mongoose.model('HR', hrSchema);

export default HR;
