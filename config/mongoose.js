const mongoose = require('mongoose');
const { configureMongoDns, getMongoUri, redactMongoUri } = require('./mongo-config');

const connectDB = async () => {
  try {
    configureMongoDns();

    const mongoUri = getMongoUri();
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB: ${redactMongoUri(mongoUri)}`);
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);

    if (err.code === 'ECONNREFUSED' && err.syscall === 'querySrv') {
      console.error(
        'MongoDB Atlas SRV DNS lookup was refused. Check your internet/DNS settings, or set MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1 in .env.'
      );
    }
  }
};

module.exports = connectDB;
