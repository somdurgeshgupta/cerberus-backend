const express = require('express');
const multer = require('multer');
const ImageKit = require('imagekit');
const { User } = require('../../models/mongoModels/users');
const router = express.Router();

const imagekit = new ImageKit({
  publicKey: "public_2uZweRqw9cEkcvvOmWQCWtWsPV0=",
  privateKey: "private_dGLRokWSZNpSVWXg6c4s3lg4v/s=",
  urlEndpoint: "https://ik.imagekit.io/atharva",
});

const upload = multer({
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

router.post('/upload-profile-image/:id', upload.single('profileImage'), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileName = `profile_${Date.now()}_${user.email}`;
    const uploadResponse = await imagekit.upload({
      file: req.file.buffer,
      fileName: fileName,
      folder: `/profile/${user.id}`,
    });

    user.profileImage = uploadResponse.url;
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
