const { expressjwt: jwt } = require("express-jwt");

function authJwt() {
    const secret = process.env.SECRET_KEY;
    const api = process.env.API_URL;
    return jwt({
        secret,
        algorithms: ['HS256'],
        isRevoked: isRevoked
    }).unless({
        path: [
            // { url: /\/public\/uploads(.*)/, methods: ['GET', 'OPTIONS'] },
            // { url: /\/api\/v1\/products(.*)/, methods: ['GET', 'OPTIONS'] },
            // { url: /\/api\/v1\/categories(.*)/, methods: ['GET', 'OPTIONS'] },
            // { url: /\/api\/v1\/orders(.*)/, methods: ['POST', 'OPTIONS'] },
            `${api}/users/login`,
            `${api}/users/register`,
        ]
    });
}

async function isRevoked(req, payload) {
    if (payload.isAdmin) {
        return true
    }
    return false;
}

function decodeToken(req) {
    try {
        const decoded = req.headers.authorization;
        return decoded;
    } catch (error) {
        // If token is invalid or userId is not found, return null
        console.error('Error decoding token:', error.message);
        return null;
    }
}


module.exports = {
    authJwt,
    decodeToken
};
