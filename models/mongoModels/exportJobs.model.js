const mongoose = require('mongoose');

const exportJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  filePath: String,
  error: String,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  totalChunks: Number,
  completedChunks: { type: Number, default: 0 },
  cancelled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ExportJob', exportJobSchema);
