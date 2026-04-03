const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { User } = require('../../models/mongoModels/users');
const router = express.Router();

const uploadDir = path.join(__dirname, '../../public/uploads/profile');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.post('/upload-profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.auth?.userId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const sanitizedEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = path.extname(req.file.originalname) || '.jpg';
    const fileName = `profile_${Date.now()}_${sanitizedEmail}${extension}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.promises.writeFile(filePath, req.file.buffer);

    if (user.profileImage && user.profileImage.includes('/public/uploads/profile/')) {
      const previousFileName = path.basename(user.profileImage);
      const previousFilePath = path.join(uploadDir, previousFileName);
      if (fs.existsSync(previousFilePath)) {
        await fs.promises.unlink(previousFilePath);
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    user.profileImage = `${baseUrl}/public/uploads/profile/${fileName}`;
    await user.save();

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      imageUrl: user.profileImage,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading profile image', error: error.message });
  }
});

module.exports = router;
