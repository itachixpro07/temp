import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const USER_ROLES = ['patient', 'doctor', 'support', 'admin', 'ambulance'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      match: [/^(?:\+91|0)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number'],
    },
    password: {
      type: String,
      required: [
        function passwordRequiredUnlessGoogle() {
          return !this.googleId;
        },
        'Password is required',
      ],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: '{VALUE} is not a supported role',
      },
      default: 'patient',
      index: true,
    },
    languagePreference: {
      type: String,
      default: 'auto',
      trim: true,
      lowercase: true,
    },
    abhaId: {
      type: String,
      default: undefined,
      trim: true,
      sparse: true,
      unique: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) {
    throw new Error('Password not loaded; query with .select("+password")');
  }
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return this.comparePassword(enteredPassword);
};

const User = mongoose.model('User', userSchema);

export default User;
