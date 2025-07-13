const express = require('express');
const router = express.Router();
const { User } = require('../models/mongoModels/users');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_AUTH_KEY);

async function decodeGoogleToken(token) {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_AUTH_KEY,
        });

        const payload = ticket.getPayload();

        return { success: true, payload };
    } catch (error) {
        console.error("Google token verification error:", error.message);
        return { success: false, error: error.message };
    }
}

router.post('/googlelogin', async (req, res) => {
    try {
        const { tokendata: token } = req.body;

        if (!token) {
            return res.status(400).send({ message: "Token is required!" });
        }

        const result = await decodeGoogleToken(token);
        if (!result.success) {
            return res.status(401).send({ message: "Invalid Google token!", error: result.error });
        }

        const { payload } = result;

        let user = await User.findOne({ email: payload.email });
        if (!user) {
            user = new User({
                name: payload.name,
                email: payload.email,
                picture: payload.picture
            });
            user = await user.save();

            if (!user) {
                return res.status(500).send({ message: "The user cannot be created!" });
            }
        }else{
            if (payload.picture !== user.picture) {
                user.picture = payload.picture;
                user = await user.save();
        
                if (!user) {
                    return res.status(500).send({ message: "The user's picture cannot be updated!" });
                }
            }
        }

        const jwtToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            },
            process.env.SECRET_KEY,
            { expiresIn: '1d' }
        );

        return res.status(200).send({ user: { payload }, token: jwtToken });
    } catch (error) {
        console.error("Error in Google login:", error.message);
        return res.status(500).send({ message: "Internal Server Error", error: error.message });
    }
});

module.exports = router;
