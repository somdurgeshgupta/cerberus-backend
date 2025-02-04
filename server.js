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

const PORT = process.env.PORT || 3000; // Ensure this works dynamically

// Connect to the database
connectToDatabaseMongoose();

// Create an Express application
const app = express();
const server = http.createServer(app); // Create HTTP server for WebSockets
const io = new Server(server, {
  cors: {
    origin: '*', // Change to your frontend domain in production
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(bodyParser.json());
app.use(cors({ origin: '*', credentials: true }));
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
