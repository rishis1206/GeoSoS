const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    unique: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['victim', 'volunteer'],
    required: [true, 'Role is required']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isBot: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    code: String,
    expiresAt: Date
  },
  rescueCount: {
    type: Number,
    default: 0
  },
  emergencyContacts: [{
    name: String,
    phone: String,
    relationship: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// This lets us search volunteers by location
userSchema.index({ location: '2dsphere' });

// Generate a 6 digit OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // expires in 10 mins
  };
  return otp;
};

// Check if OTP is valid
userSchema.methods.verifyOTP = function (code) {
  if (!this.otp || !this.otp.code) return false;
  if (new Date() > this.otp.expiresAt) return false;
  return this.otp.code === code;
};

// Update user location
userSchema.methods.updateLocation = function (lat, lng) {
  this.location = {
    type: 'Point',
    coordinates: [lng, lat]
  };
};

module.exports = mongoose.model('User', userSchema);