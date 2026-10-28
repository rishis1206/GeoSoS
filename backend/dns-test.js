const dns = require('dns');

dns.resolveSrv(
  '_mongodb._tcp.cluster0.e7ttvtm.mongodb.net',
  (err, records) => {
    console.log('ERROR:', err);
    console.log('RECORDS:', records);
  }
);