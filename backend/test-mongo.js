const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const mongoose = require('mongoose');

const uri = "mongodb+srv://sosadmin:sos123456@cluster0.e7ttvtm.mongodb.net/?appName=Cluster0";

mongoose.connect(uri)
  .then(() => {
    console.log("CONNECTED");
    process.exit(0);
  })
  .catch((err) => {
    console.log("FULL ERROR:");
    console.log(err);
    process.exit(1);
  });