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

const allowedOrigins = [
  'http://localhost:4200'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle CORS preflight requests
app.options('*', cors());

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.json());
app.use(morgan('tiny'));
app.use('/public/uploads', express.static(__dirname + '/public/uploads'));
app.use(errorHandler);

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

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
