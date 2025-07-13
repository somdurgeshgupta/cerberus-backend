require('dotenv/config');
const fs = require('fs');
const express = require('express');
const https = require('https'); // Use HTTPS instead of HTTP
const { Server } = require('socket.io');
const morgan = require('morgan');
const cors = require('cors');
const { authJwt } = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const bodyParser = require('body-parser');
const connectToDatabaseMongoose = require('./config/mongoose.js');

const PORT = process.env.PORT || 443; // Use HTTPS default port

// Connect to the database
connectToDatabaseMongoose();

// Load SSL certificate & key
const sslOptions = {
  key: fs.readFileSync('../../ssl/key.pem'),
  cert: fs.readFileSync('../../ssl/cert.pem'),
};

// Create an Express application
const app = express();
const server = https.createServer(sslOptions, app); // Create HTTPS server

// Allow CORS for specific frontend
const allowedOrigins = [
  'http://localhost:4200' // Local development (Adjust as needed)
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
app.use(bodyParser.json());
app.use(express.json());
app.use(morgan('tiny'));
app.use('/public/uploads', express.static(__dirname + '/public/uploads'));
app.use(errorHandler);

const api = process.env.API_URL;

// Import Routes
const usersRoutes = require('./routes/mongodbRoutes/users.js');
const profileRoutes = require('./routes/mongodbRoutes/profile.js');
const googlelogin = require('./helpers/google-login.js');
const chatRoutes = require('./routes/mongodbRoutes/chat.js');
const ideployRoutes = require('./routes/mongodbRoutes/ideploy.js')

// Routes for MySQL database
app.use(`${api}/users`, authJwt(), usersRoutes);
app.use(`${api}/profile`, authJwt(), profileRoutes);
app.use(`${api}/message`, authJwt(), chatRoutes);
app.use(`${api}/ideploy`, ideployRoutes);
app.use(`${api}`, googlelogin);

app.get('', (req, res) => {
  res.send("Welcome to the application latest (HTTPS Secure)");
});

// WebSocket Handling
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('sendMessage', (messageData) => {
    console.log('Message received:', messageData);
    io.emit('receiveMessage', messageData); // Broadcast to all clients
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server (Render compatible)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
