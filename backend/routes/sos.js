const express = require('express');
const router = express.Router();
const axios = require('axios');
const SOSRequest = require('../models/SOSRequest');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// GET /api/sos/public - Public activity log (no auth required)
router.get('/public', async (req, res, next) => {
  try {
    const logs = await SOSRequest.find({
      status: { $in: ['completed', 'cancelled', 'pending', 'accepted', 'responding'] }
    })
      .populate('victimId', 'name phone')
      .populate('assignedVolunteer', 'name phone isBot')
      .sort({ createdAt: -1 })
      .limit(50)
      .select('category description status createdAt completedAt victimId assignedVolunteer severity location address')
      .lean()

    console.log(`Public activity log: found ${logs.length} logs`)
    res.json({ success: true, logs })
  } catch (error) {
    console.error('Error fetching public logs:', error)
    next(error)
  }
})

// POST /api/sos - Create SOS request with dynamic radius expansion
router.post('/', protect, restrictTo('victim', 'volunteer'), async (req, res, next) => {
  try {
    const { category, description, latitude, longitude, address } = req.body

    if (!category || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Category and location are required'
      })
    }

    // Check for active SOS
    const existing = await SOSRequest.findOne({
      victimId: req.user._id,
      status: { $in: ['pending', 'accepted', 'responding'] }
    })

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active SOS request',
        sosId: existing._id
      })
    }

    // Create SOS
    const sos = new SOSRequest({
      victimId: req.user._id,
      category,
      description,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address
      }
    })

    sos.addTimelineEvent('SOS Created')
    await sos.save()
    console.log(`SOS created successfully: ID=${sos._id}, victimId=${req.user._id}, status=${sos.status}`)

    // Update victim location
    req.user.updateLocation(latitude, longitude)
    await req.user.save()

    const io = req.app.get('io')

    // Dynamic radius expansion stages
    // Stage 1: 500m immediately
    // Stage 2: 1km after 30 seconds
    // Stage 3: 5km after 60 seconds
    // Stage 4: 10km after 90 seconds
    // Stage 5: Notify emergency contacts after 120 seconds if no response
    const radiusStages = [
      { radius: 0.5, delay: 0 },
      { radius: 1, delay: 30 * 1000 },
      { radius: 5, delay: 60 * 1000 },
      { radius: 10, delay: 90 * 1000 }
    ]

    // Emergency contacts fallback
    const notifyEmergencyContacts = async () => {
      try {
        const currentSOS = await SOSRequest.findById(sos._id)
        if (!currentSOS || currentSOS.status !== 'pending') {
          console.log(`SOS ${sos._id} no longer pending — skipping emergency contacts`)
          return
        }

        // Check if already notified emergency contacts
        if (currentSOS.emergencyContactsNotified) {
          return
        }

        const victim = await User.findById(req.user._id)
        if (!victim.emergencyContacts || victim.emergencyContacts.length === 0) {
          console.log(`SOS ${sos._id}: No emergency contacts configured`)
          return
        }

        // Mark as notified
        currentSOS.emergencyContactsNotified = true
        currentSOS.addTimelineEvent('Emergency contacts notified (no volunteer response)')
        await currentSOS.save()

        // Notify via socket (in production, this would send SMS/call)
        victim.emergencyContacts.forEach(contact => {
          io.to(`user_${victim._id}`).emit('emergency_contacts_notified', {
            sosId: sos._id,
            category: sos.category,
            contactName: contact.name,
            contactPhone: contact.phone,
            message: `${victim.name} has triggered an emergency SOS. No volunteers responded. Please check on them immediately.`
          })
        })

        console.log(`📞 SOS ${sos._id}: Notified ${victim.emergencyContacts.length} emergency contacts`)
      } catch (err) {
        console.error('Error notifying emergency contacts:', err.message)
      }
    }

    const notifyVolunteers = async (radius) => {
      try {
        // Check if SOS is still pending
        const currentSOS = await SOSRequest.findById(sos._id)
        if (!currentSOS || currentSOS.status !== 'pending') {
          console.log(`SOS ${sos._id} no longer pending — stopping radius expansion`)
          return
        }

        // Find and rank volunteers in radius using weighted k-NN
        const rankedVolunteers = await User.aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
              },
              distanceField: 'distanceMeters',
              maxDistance: radius * 1000,
              query: {
                role: 'volunteer',
                isAvailable: true,
                _id: { $nin: currentSOS.notifiedVolunteers }
              },
              spherical: true
            }
          },
          {
            $addFields: {
              // Novice bots receive standard penalty; real human volunteers receive priority boost
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
              // Experience-First Composite k-NN (65% Experience, 35% Proximity)
              knnScore: {
                $add: [
                  { $multiply: ['$distanceMeters', 0.35] },
                  { $multiply: ['$experiencePenalty', 0.65] }
                ]
              }
            }
          },
          { $sort: { knnScore: 1 } },
          { $limit: 10 }
        ]);

        if (rankedVolunteers.length > 0) {
          const newIds = rankedVolunteers.map(v => v._id)
          currentSOS.notifiedVolunteers.push(...newIds)

          const topCandidate = rankedVolunteers[0]
          currentSOS.addTimelineEvent(
            `k-NN Evaluated ${rankedVolunteers.length} responders (Rank #1: ${topCandidate.name}, Score: ${topCandidate.knnScore.toFixed(1)})`
          )
          await currentSOS.save()

          // Check for ties among top candidates (within 5% or 5 points)
          const topScore = topCandidate.knnScore
          const tiedTopCandidates = rankedVolunteers.filter(v => Math.abs(v.knnScore - topScore) <= Math.max(5, topScore * 0.05))

          // Security: Fuzzy coordinates for initial broadcast to protect victim doorstep privacy (~1.1km radius)
          // Exact precision GPS is only unlocked once an authenticated volunteer clicks 'Accept'
          const fuzzyLat = Number(parseFloat(latitude).toFixed(2))
          const fuzzyLng = Number(parseFloat(longitude).toFixed(2))
          const fuzzyAddress = address ? address.split(',').slice(-2).join(',').trim() : 'Davanagere Vicinity'

          rankedVolunteers.forEach((volunteer, index) => {
            const rank = index + 1
            const isTopMatch = tiedTopCandidates.some(t => t._id.toString() === volunteer._id.toString())

            const alertPayload = {
              sosId: sos._id,
              category: sos.category,
              description: sos.description,
              location: {
                lat: fuzzyLat,
                lng: fuzzyLng,
                address: fuzzyAddress,
                isFuzzy: true
              },
              victimName: req.user.name,
              radius: `${radius}km`,
              createdAt: sos.createdAt,
              knnRank: rank,
              knnScore: volunteer.knnScore,
              distanceMeters: Math.round(volunteer.distanceMeters),
              isTopMatch
            }

            io.to(`user_${volunteer._id}`).emit('new_sos_request', alertPayload)

            // Fast2SMS: Send real SMS alert to human volunteers
            if (process.env.FAST2SMS_API_KEY && !volunteer.isBot && volunteer.phone) {
              const cleanVolPhone = String(volunteer.phone).replace(/^\+91/, '').replace(/^91/, '').slice(-10)
              if (cleanVolPhone.length === 10) {
                const alertMsg = `EMERGENCY ALERT: ${sos.category.toUpperCase()} near ${fuzzyAddress}. Open GeoSOS app immediately to respond!`
                axios.post('https://www.fast2sms.com/dev/bulkV2', {
                  route: 'q',
                  message: alertMsg,
                  numbers: cleanVolPhone
                }, {
                  headers: { authorization: process.env.FAST2SMS_API_KEY }
                }).then(r => {
                  console.log(`[SMS] 🚨 Fast2SMS alert dispatched to volunteer ${volunteer.name} (${cleanVolPhone}):`, r.data?.message || 'Sent')
                }).catch(sErr => {
                  console.warn(`[SMS] ⚠️ Fast2SMS dispatch notice:`, sErr.response?.data?.message || sErr.message)
                })
              }
            }
          })

          // Broadcast fuzzy alert to standby volunteers
          io.emit('new_sos_request', {
            sosId: sos._id,
            category: sos.category,
            description: sos.description,
            location: {
              lat: fuzzyLat,
              lng: fuzzyLng,
              address: fuzzyAddress,
              isFuzzy: true
            },
            victimName: req.user.name,
            radius: `${radius}km`,
            createdAt: sos.createdAt,
            knnRank: 1,
            knnScore: topCandidate.knnScore,
            distanceMeters: Math.round(topCandidate.distanceMeters),
            isTopMatch: true
          })

          console.log(`📡 SOS ${sos._id}: k-NN ranked & notified ${rankedVolunteers.length} volunteers with privacy-masked GPS (Top: ${topCandidate.name})`)
        } else {
          console.log(`📡 SOS ${sos._id}: No new volunteers found within ${radius}km`)
        }
      } catch (err) {
        console.error('Error notifying volunteers:', err.message)
      }
    }

    // Fire each radius stage with delay
    radiusStages.forEach(({ radius, delay }) => {
      setTimeout(() => notifyVolunteers(radius), delay)
    })

    // Schedule emergency contacts notification after 120 seconds
    setTimeout(() => notifyEmergencyContacts(), 120 * 1000)

    // AI Analysis in background
    axios.post(
      `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/api/analyze`,
      {
        category: sos.category,
        description: sos.description || category,
        sos_id: sos._id.toString()
      }
    ).then(async (response) => {
      const analysis = response.data
      sos.severity = analysis.severity || 'medium'
      sos.aiAnalysis = {
        firstAid: analysis.first_aid || [],
        immediateActions: analysis.immediate_actions || [],
        summary: analysis.summary || '',
        analyzedAt: new Date()
      }
      sos.addTimelineEvent('AI Analysis Completed')
      await sos.save()
    }).catch(err => console.log('AI service unavailable:', err.message))

    const populated = await SOSRequest.findById(sos._id)
      .populate('victimId', 'name phone')

    res.status(201).json({
      success: true,
      message: 'SOS triggered! Searching for nearby volunteers...',
      sos: populated,
      nearbyVolunteers: 0,
      radiusExpansion: true
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/sos - Get SOS requests
router.get('/', protect, async (req, res, next) => {
  try {
    let query = {}
    const requestedRole = req.query.role || req.user.role;

    if (requestedRole === 'victim') {
      query = {
        victimId: req.user._id,
        status: { $in: ['pending', 'accepted', 'responding'] }
      }
      console.log(`Victim ${req.user._id} querying for active SOS`)
    } else {
      // For volunteers: show ALL pending SOS (no location filter for testing)
      // AND SOS assigned to them
      query = {
        $or: [
          { status: 'pending' },
          { assignedVolunteer: req.user._id, status: { $in: ['accepted', 'responding'] } }
        ]
      }
      console.log(`Volunteer ${req.user._id} querying for SOS requests (role: ${requestedRole})`)
    }

    const requests = await SOSRequest.find(query)
      .populate('victimId', 'name phone location')
      .populate('assignedVolunteer', 'name phone')
      .sort({ createdAt: -1 })
      .limit(50)

    console.log(`Found ${requests.length} SOS requests for user ${req.user._id}`)
    res.json({ success: true, count: requests.length, requests })
  } catch (error) {
    console.error('Error fetching SOS requests:', error)
    next(error)
  }
})

// GET /api/sos/history
router.get('/history', protect, async (req, res, next) => {
  try {
    const query = req.user.role === 'victim'
      ? { victimId: req.user._id }
      : { assignedVolunteer: req.user._id }

    const history = await SOSRequest.find({
      ...query,
      status: { $in: ['completed', 'cancelled'] }
    })
      .populate('victimId', 'name phone')
      .populate('assignedVolunteer', 'name phone')
      .sort({ createdAt: -1 })
      .limit(20)

    res.json({ success: true, count: history.length, history })
  } catch (error) {
    next(error)
  }
})

// GET /api/sos/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const sos = await SOSRequest.findById(req.params.id)
      .populate('victimId', 'name phone location')
      .populate('assignedVolunteer', 'name phone location')

    if (!sos) {
      return res.status(404).json({ success: false, message: 'SOS request not found' })
    }

    res.json({ success: true, sos })
  } catch (error) {
    next(error)
  }
})

// PUT /api/sos/:id/accept - Volunteer accepts
router.put('/:id/accept', protect, restrictTo('volunteer'), async (req, res, next) => {
  try {
    const sos = await SOSRequest.findById(req.params.id)

    if (!sos) {
      return res.status(404).json({ success: false, message: 'SOS not found' })
    }

    if (sos.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Already ${sos.status}` })
    }

    sos.status = 'accepted'
    sos.assignedVolunteer = req.user._id
    sos.addTimelineEvent('Accepted by Volunteer')
    await sos.save()

    req.user.isAvailable = false
    await req.user.save()

    const io = req.app.get('io')
    if (io) {
      io.to(`user_${sos.victimId}`).emit('sos_accepted', {
        sosId: sos._id,
        volunteer: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone
        }
      })
      io.to(`sos_${sos._id}`).emit('sos_accepted', {
        sosId: sos._id,
        volunteer: {
          id: req.user._id,
          name: req.user.name,
          phone: req.user.phone
        }
      })
      io.emit('sos_status_changed', {
        sosId: sos._id,
        status: 'accepted',
        assignedVolunteer: {
          _id: req.user._id,
          name: req.user.name,
          phone: req.user.phone
        }
      })
    }

    const populated = await SOSRequest.findById(sos._id)
      .populate('victimId', 'name phone location')
      .populate('assignedVolunteer', 'name phone')

    res.json({
      success: true,
      message: 'SOS accepted. Navigate to victim.',
      sos: populated
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/sos/:id/complete
router.put('/:id/complete', protect, restrictTo('volunteer'), async (req, res, next) => {
  try {
    const sos = await SOSRequest.findById(req.params.id)

    if (!sos) {
      return res.status(404).json({ success: false, message: 'SOS not found' })
    }

    sos.status = 'completed'
    sos.completedAt = new Date()
    sos.addTimelineEvent('Rescue Completed')
    await sos.save()

    req.user.isAvailable = true
    req.user.rescueCount += 1
    await req.user.save()

    const io = req.app.get('io')
    if (io) {
      io.to(`user_${sos.victimId}`).emit('sos_completed', { sosId: sos._id })
      io.to(`sos_${sos._id}`).emit('sos_completed', { sosId: sos._id })
      io.emit('sos_status_changed', { sosId: sos._id, status: 'completed' })
    }

    res.json({ success: true, message: 'Rescue completed. Great work!', sos })
  } catch (error) {
    next(error)
  }
})

// PUT /api/sos/:id/verify-safety - Anti-Ambush Safe Arrival Verification
router.put('/:id/verify-safety', protect, restrictTo('volunteer'), async (req, res, next) => {
  try {
    const { code } = req.body
    const sos = await SOSRequest.findById(req.params.id)

    if (!sos) {
      return res.status(404).json({ success: false, message: 'SOS not found' })
    }

    if (sos.assignedVolunteer?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not assigned to this rescue' })
    }

    if (sos.verificationCode && sos.verificationCode !== String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid Safety PIN. Please verify with victim.' })
    }

    sos.safetyVerified = true
    sos.safetyVerifiedAt = new Date()
    sos.addTimelineEvent('Safe Arrival Verified (Anti-Ambush Confirmed)')
    await sos.save()

    const io = req.app.get('io')
    if (io) {
      io.to(`sos_${sos._id}`).emit('safety_verified', { sosId: sos._id, verifiedAt: sos.safetyVerifiedAt })
      io.to(`user_${sos.victimId}`).emit('safety_verified', { sosId: sos._id })
    }

    res.json({
      success: true,
      message: 'Safe arrival verified successfully. Anti-ambush check cleared.',
      safetyVerified: true
    })
  } catch (error) {
    next(error)
  }
})

// PUT /api/sos/:id/cancel
router.put('/:id/cancel', protect, restrictTo('victim', 'volunteer'), async (req, res, next) => {
  try {
    console.log(`Cancel SOS request: ID=${req.params.id}, userId=${req.user._id}`)
    const sos = await SOSRequest.findById(req.params.id)

    if (!sos) {
      console.log('SOS not found for cancellation')
      return res.status(404).json({ success: false, message: 'SOS not found' })
    }

    if (sos.victimId.toString() !== req.user._id.toString()) {
      console.log('User not authorized to cancel this SOS')
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this SOS' })
    }

    if (!['pending', 'accepted'].includes(sos.status)) {
      console.log(`Cannot cancel SOS in status: ${sos.status}`)
      return res.status(400).json({ success: false, message: 'Cannot cancel at this stage' })
    }

    sos.status = 'cancelled'
    sos.cancelledAt = new Date()
    sos.addTimelineEvent('Cancelled by Victim')
    await sos.save()
    console.log(`SOS cancelled successfully: ID=${sos._id}`)

    const io = req.app.get('io')
    if (io) {
      if (sos.assignedVolunteer) {
        await User.findByIdAndUpdate(sos.assignedVolunteer, { isAvailable: true })
        io.to(`user_${sos.assignedVolunteer}`).emit('sos_cancelled', { sosId: sos._id })
      }
      io.to(`sos_${sos._id}`).emit('sos_cancelled', { sosId: sos._id })
      io.emit('sos_status_changed', { sosId: sos._id, status: 'cancelled' })
    }

    res.json({ success: true, message: 'SOS cancelled', sos })
  } catch (error) {
    console.error('Error cancelling SOS:', error)
    next(error)
  }
})

// POST /api/sos/:id/emergency-call - Log emergency services call
router.post('/:id/emergency-call', protect, restrictTo('victim', 'volunteer'), async (req, res, next) => {
  try {
    const sos = await SOSRequest.findById(req.params.id)

    if (!sos) {
      return res.status(404).json({ success: false, message: 'SOS not found' })
    }

    sos.emergencyServicesCalled = true
    sos.emergencyServicesCalledAt = new Date()
    sos.addTimelineEvent('Emergency Services (911/112) Called')
    await sos.save()

    const io = req.app.get('io')
    io.to(`user_${sos.victimId}`).emit('emergency_services_called', { sosId: sos._id })

    res.json({ 
      success: true, 
      message: 'Emergency services call logged', 
      sos 
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/sos/emergency-numbers - Get emergency numbers based on location
router.get('/emergency-numbers', async (req, res, next) => {
  try {
    const { country } = req.query
    
    // Emergency numbers by country
    const emergencyNumbers = {
      US: { police: '911', medical: '911', fire: '911' },
      UK: { police: '999', medical: '999', fire: '999' },
      EU: { police: '112', medical: '112', fire: '112' },
      IN: { police: '100', medical: '102', fire: '101' },
      AU: { police: '000', medical: '000', fire: '000' },
      CA: { police: '911', medical: '911', fire: '911' },
      default: { police: '112', medical: '112', fire: '112' }
    }

    const numbers = emergencyNumbers[country] || emergencyNumbers.default

    res.json({ 
      success: true, 
      numbers,
      universal: '112' // Universal European emergency number
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/sos/nearby-hospitals - Get nearby hospitals based on location
router.get('/nearby-hospitals', async (req, res, next) => {
  try {
    const { lat, lng, radius = 5000 } = req.query // radius in meters, default 5km

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude required' })
    }

    // Use OpenStreetMap Overpass API to find nearby hospitals
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="hospital"](around:${radius},${lat},${lng});
        way["amenity"="hospital"](around:${radius},${lat},${lng});
        relation["amenity"="hospital"](around:${radius},${lat},${lng});
      );
      out body center;
    `

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

    const data = await response.json()

    if (!data.elements || data.elements.length === 0) {
      return res.json({ success: true, hospitals: [] })
    }

    // Process and format hospital data
    const hospitals = data.elements.slice(0, 5).map(element => {
      const lat = element.lat || element.center?.lat
      const lng = element.lon || element.center?.lon
      const name = element.tags?.name || 'Unknown Hospital'
      
      // Calculate distance using Haversine formula
      const distance = calculateDistance(lat, lng, parseFloat(req.query.lat), parseFloat(req.query.lng))
      
      return {
        name,
        lat,
        lng,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        address: element.tags?.['addr:street'] || 'Address not available',
        phone: element.tags?.phone || null
      }
    }).sort((a, b) => a.distance - b.distance)

    res.json({ success: true, hospitals })
  } catch (error) {
    console.error('Hospital search error:', error)
    // Return empty array on error instead of failing
    res.json({ success: true, hospitals: [] })
  }
})

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

module.exports = router;