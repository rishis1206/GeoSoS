const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
      location: req.user.location,
      isAvailable: req.user.isAvailable,
      rescueCount: req.user.rescueCount,
      emergencyContacts: req.user.emergencyContacts,
      createdAt: req.user.createdAt
    }
  });
});

// PUT /api/users/profile
router.put('/profile', protect, async (req, res, next) => {
  try {
    const { name, emergencyContacts } = req.body;
    if (name) req.user.name = name;
    if (emergencyContacts) req.user.emergencyContacts = emergencyContacts;
    await req.user.save();
    res.json({ success: true, message: 'Profile updated', user: req.user });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/emergency-contacts
router.post('/emergency-contacts', protect, async (req, res, next) => {
  try {
    const { name, phone, relationship } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    req.user.emergencyContacts.push({ name, phone, relationship });
    await req.user.save();
    
    res.json({ success: true, message: 'Emergency contact added', emergencyContacts: req.user.emergencyContacts });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/emergency-contacts/:index
router.delete('/emergency-contacts/:index', protect, async (req, res, next) => {
  try {
    const { index } = req.params;
    
    if (index < 0 || index >= req.user.emergencyContacts.length) {
      return res.status(400).json({ success: false, message: 'Invalid contact index' });
    }

    req.user.emergencyContacts.splice(index, 1);
    await req.user.save();
    
    res.json({ success: true, message: 'Emergency contact removed', emergencyContacts: req.user.emergencyContacts });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/location
router.put('/location', protect, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
    }

    req.user.updateLocation(latitude, longitude);
    await req.user.save();

    // If victim has active SOS, broadcast location
    if (req.user.role === 'victim') {
      const SOSRequest = require('../models/SOSRequest');
      const activeSOS = await SOSRequest.findOne({
        victimId: req.user._id,
        status: { $in: ['accepted', 'responding'] }
      });

      if (activeSOS) {
        const io = req.app.get('io');
        io.to(`sos_${activeSOS._id}`).emit('victim_location_update', {
          location: { lat: latitude, lng: longitude },
          timestamp: new Date()
        });
      }
    }

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;