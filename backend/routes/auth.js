const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '90d'
  });
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone, role } = req.body;
    console.log(`[AUTH] Login / OTP request received for phone: "${phone}" (role: ${role || 'any'})`);

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    }

    const rawDigits = phone.trim().replace(/[^\d]/g, '');
    const cleanPhone = rawDigits.startsWith('91') && rawDigits.length === 12
      ? rawDigits.slice(2)
      : rawDigits;

    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).'
      });
    }

    let user = await User.findOne({ phone: cleanPhone });
    const isExistingUser = !!(user && user.name && user.name !== 'temp' && user.isVerified);

    if (!user) {
      user = new User({ phone: cleanPhone, name: 'temp', role: role || 'victim' });
    }

    const otp = user.generateOTP();
    await user.save();

    console.log(`[AUTH] 🔑 OTP generated for ${cleanPhone} (existing: ${isExistingUser}): ${otp}`);

    // Dispatch via Twilio Verify Service (Live Carrier SMS)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID) {
      try {
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const toPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;
        const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
          .verifications
          .create({ to: toPhone, channel: 'sms' });
        console.log(`[AUTH] 📱 Twilio Verify SMS dispatched to ${toPhone}: status=${verification.status}`);
      } catch (twErr) {
        console.warn(`[AUTH] ⚠️ Twilio Verify dispatch notice: ${twErr.message}`);
      }
    }

    res.json({
      success: true,
      isExistingUser,
      message: 'OTP has been sent to your mobile number via SMS.'
    });
  } catch (error) {
    console.error('[AUTH] ❌ Error in send-otp:', error);
    next(error);
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, otp, name, role } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const cleanPhone = phone.trim().replace(/[^\d+]/g, '');
    const user = await User.findOne({ phone: cleanPhone });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found. Request OTP first.' });
    }

    let isValid = false;

    // Check with Twilio Verify Service
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID) {
      try {
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const toPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;
        const check = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
          .verificationChecks
          .create({ to: toPhone, code: String(otp).trim() });
        if (check.status === 'approved') {
          isValid = true;
          console.log(`[AUTH] ✓ Twilio OTP verification approved for ${toPhone}`);
        }
      } catch (twCheckErr) {
        console.warn(`[AUTH] Twilio check notice: ${twCheckErr.message}`);
      }
    }

    // Fallback check against local DB OTP
    if (!isValid && user.verifyOTP(otp)) {
      isValid = true;
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.otp = undefined;
    user.isVerified = true;

    const isNewUser = user.name === 'temp';

    if (isNewUser) {
      if (!name || !role) {
        return res.status(400).json({
          success: false,
          message: 'Name and role are required for new users',
          isNewUser: true
        });
      }
      user.name = name;
      user.role = role;
    }

    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isNewUser
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      _id: req.user._id,
      id: req.user._id,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
      location: req.user.location,
      isAvailable: req.user.isAvailable,
      rescueCount: req.user.rescueCount
    }
  });
});

module.exports = router;