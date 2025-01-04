const { expressjwt: jwt } = require("express-jwt");
const jwttoken = require('jsonwebtoken');

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
            `${api}/users/forgetpassword`,
        ]
    });
}

async function isRevoked(req, payload) {
    if (payload.isAdmin) {
        return true
    }
    return false;
}

async function decodeToken(req) {
    try {
        const token = req.headers.authorization.split(' ')[1]; // Assuming Bearer token
        const decoded = jwttoken.verify(token, process.env.SECRET_KEY); // Replace 'your-secret-key' with your actual secret key
        console.log(decoded.userId);
        return decoded;
    } catch (error) {
        console.error('Error decoding token:', error.message);
        return null;
    }
}

module.exports = {
    authJwt,
    decodeToken
};
