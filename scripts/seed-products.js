require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Product } = require('../models/mongoModels/products');
const { configureMongoDns, getMongoUri } = require('../config/mongo-config');

async function run() {
  configureMongoDns();
  const connectionString = getMongoUri();
  const seedPath = path.join(__dirname, '../data/products.seed.json');
  const products = JSON.parse(fs.readFileSync(seedPath, 'utf8').replace(/^\uFEFF/, ''));

  await mongoose.connect(connectionString);

  for (const product of products) {
    await Product.findOneAndUpdate(
      { productId: product.productId },
      { $set: product },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const total = await Product.countDocuments();
  console.log(`Seeded/updated ${products.length} products. Collection now has ${total} documents.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Failed to seed products:', error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {}
  process.exit(1);
});
