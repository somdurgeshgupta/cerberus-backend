const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Using fs.promises for async/await operations
const { User } = require('../../models/mongoModels/users'); // Adjust based on your file structure
const router = express.Router();

// Set storage engine for multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Find the user by ID to get their email
      const user = await User.findOne({ _id: req.params.id });
      if (!user) {
        return cb(new Error('User not found'), null);
      }

      // Create a folder for the user based on their email
      const userFolder = path.join('uploads', 'profiles', user.email); // Example: 'uploads/profiles/user@example.com'

      // Check if the folder exists, if not, create it
      try {
        await fs.stat(userFolder); // Check if folder exists
        cb(null, userFolder); // Folder exists, proceed with upload
      } catch (error) {
        // Folder does not exist, create it
        await fs.mkdir(userFolder, { recursive: true });
        cb(null, userFolder); // Folder created, proceed with upload
      }
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    // Set the file name to be unique by appending a timestamp
    cb(null, Date.now() + path.extname(file.originalname)); // e.g., 1617075443322.jpg
  }
});

// File filter to allow only image files (JPG, JPEG, PNG)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Initialize multer with the storage configuration
const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5 MB
});

// Router to handle image upload
router.post('/upload-profile-image/:id', upload.single('profileImage'), async (req, res) => {
  try {
    // Find the user by ID
    const user = await User.findOne({ _id: req.params.id });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user's profile image URL
    user.profileImage = `uploads/profiles/${user.email}/${req.file.filename}`; // Save the image path in the DB

    await user.save(); // Save the updated user profile

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      imageUrl: user.profileImage, // Return the image URL to the user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading profile image' });
  }
});

module.exports = router;
