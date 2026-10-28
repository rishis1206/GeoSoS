const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const BOTS = [
  {
    name: 'Kavya (Civic Novice)',
    phone: '+919000000001',
    role: 'volunteer',
    isBot: true,
    isAvailable: true,
    isVerified: true,
    rescueCount: 0,
    // ~350m North-East of GMIT
    location: {
      type: 'Point',
      coordinates: [75.9245, 14.4698]
    }
  },
  {
    name: 'Manoj (Community Patrol)',
    phone: '+919000000002',
    role: 'volunteer',
    isBot: true,
    isAvailable: true,
    isVerified: true,
    rescueCount: 1,
    // ~850m South-East of GMIT
    location: {
      type: 'Point',
      coordinates: [75.9288, 14.4625]
    }
  },
  {
    name: 'Pooja (Campus Area)',
    phone: '+919000000003',
    role: 'volunteer',
    isBot: true,
    isAvailable: true,
    isVerified: true,
    rescueCount: 1,
    // ~1.2km North-West of GMIT
    location: {
      type: 'Point',
      coordinates: [75.9135, 14.4735]
    }
  },
  {
    name: 'Rohan (Davanagere Ward 4)',
    phone: '+919000000004',
    role: 'volunteer',
    isBot: true,
    isAvailable: true,
    isVerified: true,
    rescueCount: 0,
    // ~1.8km South of GMIT
    location: {
      type: 'Point',
      coordinates: [75.9215, 14.4512]
    }
  },
  {
    name: 'Anjali (Civic Unit)',
    phone: '+919000000005',
    role: 'volunteer',
    isBot: true,
    isAvailable: true,
    isVerified: true,
    rescueCount: 1,
    // ~2.2km West of GMIT
    location: {
      type: 'Point',
      coordinates: [75.9015, 14.4645]
    }
  }
];

async function seedBots() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // Remove older bots
    const deleted = await User.deleteMany({ isBot: true });
    console.log(`Cleared ${deleted.deletedCount} existing volunteer bots.`);

    // Insert new bots
    const created = await User.insertMany(BOTS);
    console.log(`✅ Successfully seeded ${created.length} volunteer bots around GMIT Davanagere:`);
    created.forEach(b => {
      console.log(`   - ${b.name} | Rescues: ${b.rescueCount} | Coordinates: [${b.location.coordinates}]`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
}

seedBots();
