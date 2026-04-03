const express = require('express');
const router = express.Router();
const { User } = require('../models/mongoModels/users');
const { OAuth2Client } = require('google-auth-library');
const {
    createAccessToken,
    createRefreshToken,
    getAccessTokenExpiry,
    setRefreshTokenCookie,
    createSessionId
} = require('./jwt');

const client = new OAuth2Client(process.env.GOOGLE_AUTH_KEY);
const MAX_ACTIVE_SESSIONS = 5;

const normalizeRefreshSessions = (sessions = []) =>
    (Array.isArray(sessions) ? sessions : [])
        .map((session) => {
            if (!session) {
                return null;
            }

            if (typeof session === 'string') {
                return {
                    sessionId: createSessionId(),
                    token: session,
                    createdAt: new Date(),
                    lastUsedAt: new Date(),
                    userAgent: 'Unknown device',
                    ipAddress: ''
                };
            }

            const plainSession = typeof session.toObject === 'function' ? session.toObject() : session;
            return {
                sessionId: plainSession.sessionId || createSessionId(),
                token: plainSession.token || '',
                createdAt: plainSession.createdAt || new Date(),
                lastUsedAt: plainSession.lastUsedAt || plainSession.createdAt || new Date(),
                userAgent: plainSession.userAgent || 'Unknown device',
                ipAddress: plainSession.ipAddress || ''
            };
        })
        .filter((session) => session && session.token);

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

        const sessionId = createSessionId();
        const accessToken = createAccessToken(user);
        const refreshToken = createRefreshToken(user, sessionId);
        user.refreshTokens = [
            ...normalizeRefreshSessions(user.refreshTokens),
            {
                sessionId,
                token: refreshToken,
                createdAt: new Date(),
                lastUsedAt: new Date(),
                userAgent: req.get('user-agent') || 'Unknown device',
                ipAddress: req.ip
            }
        ].slice(-MAX_ACTIVE_SESSIONS);
        await user.save();
        setRefreshTokenCookie(res, refreshToken);

        return res.status(200).send({
            user: { payload },
            accessToken,
            accessTokenExpiresIn: getAccessTokenExpiry()
        });
    } catch (error) {
        console.error("Error in Google login:", error.message);
        return res.status(500).send({ message: "Internal Server Error", error: error.message });
    }
});

module.exports = router;
