require('dotenv/config');
const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cors = require('cors');
const { authJwt } = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const bodyParser = require('body-parser');
const connectToDatabaseMongoose = require('./config/mongoose.js');

const PORT = process.env.PORT || 3000;

// Connect to the database
connectToDatabaseMongoose();

const app = express();
const server = http.createServer(app);

const configuredOrigins = [
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim().replace(/\/$/, '')] : []),
  ...(process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean)
    : [])
];

const allowedOrigins = [
  'http://localhost:4200',
  'https://project-cerberus-seven.vercel.app',
  ...configuredOrigins
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${normalizedOrigin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle CORS preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.json());
app.use(morgan('tiny'));
app.use('/public/uploads', express.static(__dirname + '/public/uploads'));

const api = process.env.API_URL;

// Import Routes
const usersRoutes = require('./routes/mongodbRoutes/users.js');
const profileRoutes = require('./routes/mongodbRoutes/profile.js');
const storeRoutes = require('./routes/mongodbRoutes/store.js');
const googlelogin = require('./helpers/google-login.js');

// Routes for MySQL database
app.use(`${api}/users`, authJwt(), usersRoutes);
app.use(`${api}/profile`, authJwt(), profileRoutes);
app.use(`${api}/store`, storeRoutes);
app.use(`${api}`, googlelogin);

app.get('', (req, res) => {
  res.send('Welcome to the application');
});

app.use(errorHandler);

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
