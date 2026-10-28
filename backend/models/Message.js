const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sosId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOSRequest',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  message: {
    type: String,
    required: [true, 'Message cannot be empty'],
    maxlength: [1000, 'Message too long'],
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'system', 'ai_instruction'],
    default: 'text'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

messageSchema.index({ sosId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);