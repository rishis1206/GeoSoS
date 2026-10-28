const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const SOSRequest = require('../models/SOSRequest');
const { protect } = require('../middleware/auth');

// GET /api/messages/:sosId
router.get('/:sosId', protect, async (req, res, next) => {
  try {
    const sos = await SOSRequest.findById(req.params.sosId);

    if (!sos) {
      return res.status(404).json({ success: false, message: 'SOS not found' });
    }

    const messages = await Message.find({ sosId: req.params.sosId })
      .populate('senderId', 'name role')
      .sort({ timestamp: 1 })
      .limit(100);

    // Mark as read
    await Message.updateMany(
      { sosId: req.params.sosId, receiverId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
});

// POST /api/messages
router.post('/', protect, async (req, res, next) => {
  try {
    const { sosId, message } = req.body;

    if (!sosId || !message) {
      return res.status(400).json({ success: false, message: 'SOS ID and message are required' });
    }

    const sos = await SOSRequest.findById(sosId);

    if (!sos) {
      return res.status(404).json({ success: false, message: 'SOS not found' });
    }

    const isVictim = sos.victimId.toString() === req.user._id.toString();
    const receiverId = isVictim ? (sos.assignedVolunteer || null) : sos.victimId;

    const newMessage = await Message.create({
      sosId,
      senderId: req.user._id,
      receiverId,
      message: message.trim()
    });

    const populated = await Message.findById(newMessage._id)
      .populate('senderId', 'name role');

    // Emit via socket to SOS room AND user rooms + global broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(`sos_${sosId}`).emit('new_message', populated);
      if (receiverId) {
        io.to(`user_${receiverId}`).emit('new_message', populated);
      }
      io.to(`user_${req.user._id}`).emit('new_message', populated);
      io.emit('chat_message_received', populated);
    }

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;