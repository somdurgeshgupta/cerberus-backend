const express = require('express');
const router = express.Router();
const Message = require('../../models/mongoModels/Message');

// Save a new message
router.post('/send', async (req, res) => {
    try {
        const { senderId, receiverId, message } = req.body;
        const newMessage = new Message({ senderId, receiverId, message });
        await newMessage.save();
        res.json({ success: true, message: 'Message saved!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get chat history
router.post('/history', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const messages = await Message.find({
            $or: [
                { senderId, receiverId },
                { senderId: receiverId, receiverId: senderId }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


module.exports = router;