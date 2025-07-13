const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const mongoose = require('mongoose');
const { format } = require('@fast-csv/format');
const { InventoryRecord } = require('../../models/mongoModels/iDeploy');
const ExportJob = require('../../models/mongoModels/exportJobs.model');

const TEMP_DIR = path.join(os.tmpdir(), 'csv-export-background');
const CHUNK_SIZE = 100_000;

// Ensure TEMP_DIR exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Helper: Stream to Promise
const streamToPromise = stream =>
  new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

// Helper: Chunk boundaries
const getChunkBoundaries = async () => {
  const ids = [];
  const totalCount = await InventoryRecord.estimatedDocumentCount();
  const totalChunks = Math.ceil(totalCount / CHUNK_SIZE);
  const chunkSize = Math.ceil(totalCount / totalChunks);

  const cursor = InventoryRecord.find({}, { _id: 1 }).sort({ _id: 1 }).lean().cursor();
  let i = 0;
  for await (const doc of cursor) {
    if (i % chunkSize === 0) ids.push(doc._id);
    i++;
  }

  return { ids, totalChunks, totalCount };
};

// Helper: Export chunk to CSV
const exportChunkToFile = async (startId, endId, partIndex) => {
  const filename = path.join(TEMP_DIR, `data_part_${partIndex}.csv`);
  const writeStream = fs.createWriteStream(filename);
  const csvStream = format({ headers: true });
  csvStream.pipe(writeStream);

  const query = endId ? { _id: { $gte: startId, $lt: endId } } : { _id: { $gte: startId } };
  const cursor = InventoryRecord.find(query).sort({ _id: 1 }).lean().cursor();

  let count = 0;
  for await (const doc of cursor) {
    csvStream.write(doc);
    count++;
    if (count % 100000 === 0) {
      console.log(`📊 Chunk ${partIndex}: ${count} records written`);
    }
  }

  csvStream.end();
  await streamToPromise(writeStream);
  console.log(`✅ Finished chunk ${partIndex}, total records: ${count}`);
  return filename;
};

// Helper: Zip files
const zipFiles = async (jobId, files) => {
  const zipPath = path.join(TEMP_DIR, `${jobId}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', err => { throw err; });
  archive.pipe(output);

  for (const file of files) {
    archive.file(file, { name: path.basename(file) });
  }

  await archive.finalize();
  await streamToPromise(output);

  for (const file of files) {
    try {
      await fs.promises.unlink(file);
    } catch (err) {
      console.warn(`⚠️ Could not delete chunk: ${file}`);
    }
  }

  return zipPath;
};

// API: Start export
// API: Start export
router.get('/export-csv', async (req, res) => {
  const userId = new mongoose.Types.ObjectId('6873c30b8546479a5e9ea6c6'); // Replace with req.user._id in production

  // Create export job entry
  const job = await ExportJob.create({
    userId,
    status: 'pending',
    totalChunks: 0,
    completedChunks: 0,
    cancelled: false // Optional: include default in schema too
  });

  // ✅ Respond immediately to frontend
  res.json({ message: 'Export started', jobId: job._id });

  // 🧠 Background processing starts here
  (async () => {
    try {
      // Mark job as "processing"
      await ExportJob.findByIdAndUpdate(job._id, { status: 'processing' });

      // 🔁 Check if user cancelled before even starting
      const isCancelledEarly = await ExportJob.findById(job._id);
      if (isCancelledEarly?.cancelled) {
        await ExportJob.findByIdAndUpdate(job._id, { status: 'cancelled' });
        console.log(`🚫 Export job ${job._id} was cancelled before start`);
        return;
      }

      // 🔢 Get chunk info
      const { ids: boundaries, totalChunks, totalCount } = await getChunkBoundaries();

      if (totalCount === 0) {
        await ExportJob.findByIdAndUpdate(job._id, {
          status: 'failed',
          error: 'No records to export'
        });
        return;
      }

      // Store total chunks in DB
      await ExportJob.findByIdAndUpdate(job._id, { totalChunks });

      const csvFiles = [];

      // ⬇️ Export each chunk
      for (let i = 0; i < totalChunks; i++) {
        const currentJob = await ExportJob.findById(job._id);
        if (currentJob?.cancelled) {
          console.log(`🛑 Export job ${job._id} was cancelled during processing`);
          await ExportJob.findByIdAndUpdate(job._id, { status: 'cancelled' });
          return;
        }

        const startId = boundaries[i];
        const endId = boundaries[i + 1];

        const file = await exportChunkToFile(startId, endId, i + 1);
        csvFiles.push(file);

        await ExportJob.findByIdAndUpdate(job._id, { $inc: { completedChunks: 1 } });
      }

      // 🗜️ Create ZIP file
      try {
        const zipPath = await zipFiles(job._id, csvFiles);

        if (!fs.existsSync(zipPath)) {
          throw new Error('Zip file was not created');
        }

        await ExportJob.findByIdAndUpdate(job._id, {
          status: 'completed',
          filePath: zipPath,
          completedAt: new Date()
        });

        console.log(`✅ Export job ${job._id} completed. File: ${zipPath}`);
      } catch (zipErr) {
        console.error(`❌ Zip creation failed: ${zipErr.message}`);
        await ExportJob.findByIdAndUpdate(job._id, {
          status: 'failed',
          error: 'Zip creation failed: ' + zipErr.message
        });
      }

    } catch (err) {
      console.error('❌ Export process failed:', err);
      await ExportJob.findByIdAndUpdate(job._id, {
        status: 'failed',
        error: err.message
      });
    }
  })();
});


// API: Download file
router.get('/exports/download/:jobId', async (req, res) => {
  const job = await ExportJob.findById(req.params.jobId);
  if (!job || job.status !== 'completed') {
    return res.status(404).json({ message: 'Export not completed or not found' });
  }

  if (!job.filePath || !fs.existsSync(job.filePath)) {
    return res.status(404).json({ message: 'File not available' });
  }

  res.download(job.filePath, `data_export_${job._id}.zip`);
});

router.post('/exports/cancel/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  const job = await ExportJob.findById(jobId);

  if (!job || !['pending', 'processing'].includes(job.status)) {
    return res.status(400).json({ message: 'Job is not cancellable' });
  }

  await ExportJob.findByIdAndUpdate(jobId, { cancelled: true });
  res.json({ message: 'Export cancellation requested' });
});


// API: Fetch user's export jobs
router.get('/exports/mine', async (req, res) => {
  const userId = '6873c30b8546479a5e9ea6c6'; // Replace with req.user._id in real app
  const jobs = await ExportJob.find({ userId }).sort({ createdAt: -1 }).lean();
  res.json(jobs);
});

// IIFE: Cleanup on server start
(async () => {
  try {
    console.log('🟡 Cleaning up old export jobs...');
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const oldJobs = await ExportJob.find({ createdAt: { $lt: cutoff } });

    for (const job of oldJobs) {
      try {
        if (job.filePath && fs.existsSync(job.filePath)) {
          await fs.promises.unlink(job.filePath);
          console.log(`🧹 Deleted file: ${job.filePath}`);
        }
        await job.deleteOne();
        console.log(`🗑️  Deleted export job: ${job._id}`);
      } catch (err) {
        console.warn(`⚠️ Could not delete job ${job._id}: ${err.message}`);
      }
    }

    if (oldJobs.length === 0) {
      console.log('✅ No expired export jobs found.');
    }
  } catch (err) {
    console.error('❌ Startup cleanup failed:', err.message);
  }
})();

module.exports = router;
