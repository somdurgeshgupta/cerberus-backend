const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.connect(`${process.env.CONNECTION_STRING}${process.env.DBNAME}`)
      .then(() => {
        console.log('Connected to MongoDB');
      })
      .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
      });
  } catch (err) {
    console.log(err)
  }
};

module.exports = connectDB;
