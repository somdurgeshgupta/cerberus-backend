// Import required modules
require('dotenv/config');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { authJwt } = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const fs = require('fs');
const https = require('https');
const http = require('http');
const bodyParser = require('body-parser');
const connectToDatabaseMongoose = require('./config/mongoose.js'); // MongoDB connection

// Connect to the database
connectToDatabaseMongoose();

// Create an Express application
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Alternatively, configure specific domains and methods
app.use(cors({
  origin: '*', // Replace with your Angular app's URL
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true // If using cookies/auth
}));

app.use(express.json());
app.options('*', cors());
app.use(morgan('tiny'));
app.use('/public/uploads', express.static(__dirname + '/public/uploads'));
app.use(errorHandler);

// Routes
const usersRoutes = require('./routes/mongodbRoutes/users.js');
const googlelogin = require('./helpers/google-login.js');

const api = process.env.API_URL;

app.use(`${api}/users`, authJwt(), usersRoutes);
app.use(`${api}`, googlelogin);
app.use(`/`, (req, res) => {
  res.send('Welcome to API');
});

// Routes for mysql database
// app.use(`${api}/mysql`, require('./routes/mysqlRoutes'));

// No authJwt middleware for testing route
// app.use(`${api}`, testing);

// Redirect HTTP to HTTPS
http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  res.end();
}).listen(80, () => {
  console.log('HTTP server running on port 80 (redirecting to HTTPS)');
});

// HTTPS configuration
const sslOptions = {
  key: fs.readFileSync('/home/ubuntu/ssl/private-key.pem'),
  cert: fs.readFileSync('/home/ubuntu/ssl/certificate.pem'),
  // ca: fs.readFileSync('/path/to/your/ca-cert.pem'), // Update if needed, for chain certificates
};

// Start HTTPS server
https.createServer(sslOptions, app).listen(443, () => {
  console.log('HTTPS server running on port 443');
});
