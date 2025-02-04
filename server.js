require('dotenv/config');
const express = require('express');
const http = require('http'); // Required for WebSockets
const { Server } = require('socket.io'); // Import socket.io
const morgan = require('morgan');
const cors = require('cors');
const { authJwt } = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const bodyParser = require('body-parser');
const connectToDatabaseMongoose = require('./config/mongoose.js');

const PORT = process.env.PORT || 3000;

// Connect to the database
connectToDatabaseMongoose();

// Create an Express application
const app = express();
const server = http.createServer(app); // Create HTTP server for WebSockets

// Allow CORS for specific frontend
const allowedOrigins = [
  'https://main.dm5guw9s7uphw.amplifyapp.com', // Your Amplify frontend URL
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

// Routes for MySQL database
app.use(`${api}/users`, authJwt(), usersRoutes);
app.use(`${api}/profile`, authJwt(), profileRoutes);
app.use(`${api}/message`, authJwt(), chatRoutes);
app.use(`${api}`, googlelogin);

// WebSocket Handling
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Only allow specified origins
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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
