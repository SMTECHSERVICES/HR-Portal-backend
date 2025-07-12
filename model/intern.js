import mongoose from "mongoose";
import bcrypt from 'bcryptjs';

const internSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique:true
  },
  university: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  attendance: [
    {
      date: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['Present', 'Absent', 'Leave','Half Day', 'Week off'],
        default: 'Present'
      }
    }
  ],
  assignment: [
    {
      title: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      pptFile: String,
      deadline: {
        type: Date,
        required: true
      },
      isComplete: {
        type: Boolean,
        default: false
      }
    }
  ],
}, {
  timestamps: true
});

// Password hashing middleware
internSchema.pre('save', async function (next) {
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
internSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const Intern = mongoose.model('Intern', internSchema);

export default Intern;
