const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// GET /api/volunteers/nearby
router.get('/nearby', protect, async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 10, useKnn, k = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
    }

    if (useKnn === 'true') {
      const kLimit = parseInt(k) || 10;
      const volunteers = await User.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            distanceField: 'distanceMeters',
            maxDistance: parseInt(radius) * 1000,
            query: { role: 'volunteer', isAvailable: true },
            spherical: true
          }
        },
        {
          $addFields: {
            // Experience Penalty: Bots receive standard penalty; real human volunteers receive priority boost
            experiencePenalty: {
              $cond: [
                { $eq: ['$isBot', true] },
                { $divide: [1000, { $add: [{ $ifNull: ['$rescueCount', 0] }, 1] }] },
                { $divide: [1000, { $add: [{ $ifNull: ['$rescueCount', 0] }, 15] }] }
              ]
            }
          }
        },
        {
          $addFields: {
            // Experience-First Composite k-NN distance metric (65% Experience, 35% Proximity)
            knnScore: {
              $add: [
                { $multiply: ['$distanceMeters', 0.35] },
                { $multiply: ['$experiencePenalty', 0.65] }
              ]
            }
          }
        },
        { $sort: { knnScore: 1 } },
        { $limit: kLimit },
        {
          $project: {
            name: 1,
            location: 1,
            isAvailable: 1,
            isBot: 1,
            lastSeen: 1,
            rescueCount: 1,
            distanceMeters: 1,
            knnScore: 1
          }
        }
      ]);

      return res.json({ success: true, count: volunteers.length, mode: 'knn', volunteers });
    }

    const volunteers = await User.find({
      role: 'volunteer',
      isAvailable: true,
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius) * 1000
        }
      }
    }).select('name location isAvailable lastSeen rescueCount').limit(20);

    res.json({ success: true, count: volunteers.length, mode: 'geospatial', volunteers });
  } catch (error) {
    next(error);
  }
});

// GET /api/volunteers/smart-nearby (Dedicated Multi-Criteria k-NN matching endpoint)
router.get('/smart-nearby', protect, async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 10, k = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
    }

    const kLimit = parseInt(k) || 10;
    const volunteers = await User.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          distanceField: 'distanceMeters',
          maxDistance: parseInt(radius) * 1000,
          query: { role: 'volunteer', isAvailable: true },
          spherical: true
        }
      },
      {
        $addFields: {
          knnScore: {
            $add: [
              { $multiply: ['$distanceMeters', 0.7] },
              { $divide: [1000, { $add: ['$rescueCount', 1] }] }
            ]
          }
        }
      },
      { $sort: { knnScore: 1 } },
      { $limit: kLimit },
      {
        $project: {
          name: 1,
          location: 1,
          isAvailable: 1,
          lastSeen: 1,
          rescueCount: 1,
          distanceMeters: 1,
          knnScore: 1
        }
      }
    ]);

    res.json({ success: true, count: volunteers.length, mode: 'knn', volunteers });
  } catch (error) {
    next(error);
  }
});

// PUT /api/volunteers/location
router.put('/location', protect, restrictTo('volunteer'), async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Location required' });
    }

    req.user.updateLocation(latitude, longitude);
    await req.user.save();

    // Broadcast to active SOS room
    const SOSRequest = require('../models/SOSRequest');
    const activeSOS = await SOSRequest.findOne({
      assignedVolunteer: req.user._id,
      status: { $in: ['accepted', 'responding'] }
    });

    if (activeSOS) {
      const io = req.app.get('io');
      io.to(`sos_${activeSOS._id}`).emit('volunteer_location_update', {
        location: { lat: latitude, lng: longitude },
        timestamp: new Date()
      });
    }

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/volunteers/availability
router.put('/availability', protect, restrictTo('volunteer'), async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    req.user.isAvailable = isAvailable;
    await req.user.save();
    res.json({ success: true, isAvailable: req.user.isAvailable });
  } catch (error) {
    next(error);
  }
});

// GET /api/volunteers/radar-bots - Return simulated bot positions for radar map
router.get('/radar-bots', async (req, res, next) => {
  try {
    const bots = await User.find({ isBot: true, isAvailable: true })
      .select('name location rescueCount role isBot')
      .lean();

    // Add slight live wandering/jitter to simulate active patrolling
    const roamingBots = bots.map((bot, index) => {
      const coords = bot.location?.coordinates || [75.9218, 14.4673];
      // Time-based cyclic roaming offset
      const timeSec = Math.floor(Date.now() / 3000) + (index * 45);
      const jitterLng = Math.sin(timeSec * 0.1) * 0.0003;
      const jitterLat = Math.cos(timeSec * 0.1) * 0.0003;

      return {
        id: bot._id,
        name: bot.name,
        rescueCount: bot.rescueCount,
        isBot: true,
        location: {
          lng: coords[0] + jitterLng,
          lat: coords[1] + jitterLat
        }
      };
    });

    res.json({ success: true, count: roamingBots.length, bots: roamingBots });
  } catch (error) {
    next(error);
  }
});

module.exports = router;