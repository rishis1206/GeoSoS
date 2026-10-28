const mongoose = require('mongoose');

const sosRequestSchema = new mongoose.Schema({
  victimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['medical', 'accident', 'fire', 'assault', 'natural_disaster', 'other'],
    required: [true, 'Emergency category is required']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: String
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'responding', 'completed', 'cancelled'],
    default: 'pending'
  },
  assignedVolunteer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notifiedVolunteers: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}],
  aiAnalysis: {
    firstAid: [String],
    immediateActions: [String],
    summary: String,
    analyzedAt: Date
  },
  timeline: [{
    event: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  completedAt: Date,
  cancelledAt: Date,
  emergencyServicesCalled: {
    type: Boolean,
    default: false
  },
  emergencyServicesCalledAt: Date,
  emergencyContactsNotified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: () => Math.floor(1000 + Math.random() * 9000).toString() // 4-digit anti-ambush safety code
  },
  safetyVerified: {
    type: Boolean,
    default: false
  },
  safetyVerifiedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Search SOS requests by location
sosRequestSchema.index({ location: '2dsphere' });
sosRequestSchema.index({ status: 1, createdAt: -1 });

// Add event to timeline
sosRequestSchema.methods.addTimelineEvent = function (event) {
  this.timeline.push({ event, timestamp: new Date() });
};

module.exports = mongoose.model('SOSRequest', sosRequestSchema);