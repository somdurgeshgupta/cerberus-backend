const { expressjwt: jwt } = require("express-jwt");
const { randomUUID } = require('crypto');
const jwttoken = require('jsonwebtoken');

const getAccessTokenSecret = () => process.env.SECRET_KEY;
const getRefreshTokenSecret = () => process.env.REFRESH_TOKEN_SECRET || process.env.SECRET_KEY;
const getAccessTokenExpiry = () => process.env.JWT_EXPIRES_IN || '15m';
const getRefreshTokenExpiry = () => process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const getRefreshTokenCookieName = () => process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken';
const shouldUseSecureCookies = () => process.env.NODE_ENV === 'production';
const getRefreshTokenCookieSameSite = () => process.env.REFRESH_TOKEN_COOKIE_SAME_SITE || (shouldUseSecureCookies() ? 'none' : 'lax');

function authJwt() {
    const secret = getAccessTokenSecret();
    return jwt({
        secret,
        algorithms: ['HS256'],
        isRevoked: isRevoked
    }).unless({
        path: [
            { url: /\/api\/v1\/users\/login\/?$/, methods: ['POST'] },
            { url: /\/api\/v1\/users\/register\/?$/, methods: ['POST'] },
            { url: /\/api\/v1\/users\/refresh-token\/?$/, methods: ['POST'] },
            { url: /\/api\/v1\/users\/logout\/?$/, methods: ['POST'] },
            { url: /\/api\/v1\/users\/forgetpassword\/?$/, methods: ['POST'] },
            { url: /\/api\/v1\/users\/get\/count\/?$/, methods: ['GET'] }
        ]
    });
}

async function isRevoked(req, payload) {
    return false;
}

async function decodeToken(req) {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwttoken.verify(token, getAccessTokenSecret()); 
        console.log(decoded.userId);
        return decoded;
    } catch (error) {
        console.error('Error decoding token:', error.message);
        return null;
    }
}

function createAccessToken(user) {
    return jwttoken.sign(
        {
            userId: user.id,
            email: user.email,
            isAdmin: user.isAdmin
        },
        getAccessTokenSecret(),
        { expiresIn: getAccessTokenExpiry() }
    );
}

function createRefreshToken(user, sessionId = randomUUID()) {
    return jwttoken.sign(
        {
            userId: user.id,
            sessionId,
            tokenType: 'refresh'
        },
        getRefreshTokenSecret(),
        { expiresIn: getRefreshTokenExpiry() }
    );
}

function verifyRefreshToken(token) {
    return jwttoken.verify(token, getRefreshTokenSecret());
}

function getRefreshTokenCookieOptions() {
    return {
        httpOnly: true,
        secure: shouldUseSecureCookies(),
        sameSite: getRefreshTokenCookieSameSite(),
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
    };
}

function setRefreshTokenCookie(res, refreshToken) {
    res.cookie(getRefreshTokenCookieName(), refreshToken, getRefreshTokenCookieOptions());
}

function clearRefreshTokenCookie(res) {
    res.clearCookie(getRefreshTokenCookieName(), {
        httpOnly: true,
        secure: shouldUseSecureCookies(),
        sameSite: getRefreshTokenCookieSameSite(),
        path: '/'
    });
}

function getRefreshTokenFromRequest(req) {
    return req.cookies?.[getRefreshTokenCookieName()] || null;
}

module.exports = {
    authJwt,
    decodeToken,
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken,
    getAccessTokenExpiry,
    getRefreshTokenExpiry,
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    getRefreshTokenFromRequest,
    createSessionId: randomUUID
};
