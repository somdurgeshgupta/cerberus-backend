const express = require('express');
const multer = require('multer'); // Still used for parsing multipart form-data
const ImageKit = require('imagekit');
const { User } = require('../../models/mongoModels/users'); // Adjust based on your file structure
const router = express.Router();

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: "public_2uZweRqw9cEkcvvOmWQCWtWsPV0=",     // Replace with your ImageKit Public API Key
  privateKey: "private_dGLRokWSZNpSVWXg6c4s3lg4v/s=",  // Replace with your ImageKit Private API Key
  urlEndpoint: "https://ik.imagekit.io/atharva", // Replace with your ImageKit URL Endpoint
});

// Initialize multer for parsing form-data (without storage)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Router to handle profile image upload
router.post('/upload-profile-image/:id', upload.single('profileImage'), async (req, res) => {
  try {
    // Find the user by ID
    const user = await User.findOne({ _id: req.params.id });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload the image to ImageKit
    const fileName = `profile_${Date.now()}_${user.email}`;
    const uploadResponse = await imagekit.upload({
      file: req.file.buffer, // Use buffer from the uploaded file
      fileName: fileName,
      folder: `/profile/${user.id}`, // Organize files in user-specific folders
    });

    // Update the user's profile image URL
    user.profileImage = uploadResponse.url; // Save the ImageKit URL in the database
    await user.save();

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      imageUrl: user.profileImage, // Return the ImageKit URL to the user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading profile image', error: error.message });
  }
});

module.exports = router;
