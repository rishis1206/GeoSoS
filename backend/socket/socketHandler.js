const jwt = require('jsonwebtoken');
const User = require('../models/User');

const initializeSocket = (io) => {

  // Verify JWT on every socket connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication error: No token'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-otp');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Connected: ${socket.user.name} (${socket.user.role})`);

    // Join personal room so we can send direct notifications
    socket.join(`user_${userId}`);

    // Join a specific SOS room for real-time chat + location
    socket.on('join_sos_room', (rawSosId) => {
      const sosId = typeof rawSosId === 'object' && rawSosId?._id ? String(rawSosId._id) : String(rawSosId || '');
      if (sosId) {
        socket.join(`sos_${sosId}`);
        console.log(`📡 ${socket.user.name} joined SOS room: ${sosId}`);
      }
    });

    socket.on('leave_sos_room', (rawSosId) => {
      const sosId = typeof rawSosId === 'object' && rawSosId?._id ? String(rawSosId._id) : String(rawSosId || '');
      if (sosId) {
        socket.leave(`sos_${sosId}`);
      }
    });

    // Real-time location updates
    socket.on('update_location', async ({ latitude, longitude, sosId }) => {
      try {
        socket.user.updateLocation(latitude, longitude);
        await socket.user.save();

        if (sosId) {
          const event = socket.user.role === 'victim'
            ? 'victim_location_update'
            : 'volunteer_location_update';

          socket.to(`sos_${sosId}`).emit(event, {
            location: { lat: latitude, lng: longitude },
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Location update error:', error.message);
      }
    });

    // Typing indicator
    socket.on('typing', ({ sosId, isTyping }) => {
      socket.to(`sos_${sosId}`).emit('user_typing', {
        name: socket.user.name,
        isTyping
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.user.name}`);
    });
  });
};

module.exports = { initializeSocket };