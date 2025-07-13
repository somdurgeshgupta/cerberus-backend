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
            { url: `${api}/users/login`, methods: ['POST'] },
            { url: `${api}/users/register`, methods: ['POST'] },
            { url: `${api}/users/forgetpassword`, methods: ['POST'] },
            { url: `${api}/users/get/count`, methods: ['GET'] }
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
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwttoken.verify(token, process.env.SECRET_KEY); 
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
