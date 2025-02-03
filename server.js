// Import required modules
require('dotenv/config');
const express = require('express');
const http = require('http'); // Required for socket.io
const { Server } = require('socket.io'); // Import socket.io
const morgan = require('morgan');
const cors = require('cors');
const { authJwt } = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const bodyParser = require('body-parser');
const connectToDatabaseMongoose = require('./config/mongoose.js');

const PORT = process.env.port || 3000;

// Connect to the database
connectToDatabaseMongoose();

// Create an Express application
const app = express();
const server = http.createServer(app); // Create HTTP server for socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Replace with your Angular app's URL if needed
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

app.use(cors({
  origin: '*', // Adjust if needed
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true
}));

app.use(express.json());
app.options('*', cors());
app.use(morgan('tiny'));
app.use('/public/uploads', express.static(__dirname + '/public/uploads'));
app.use(errorHandler);

const api = process.env.API_URL;

const usersRoutes = require('./routes/mongodbRoutes/users.js');
const profileRoutes = require('./routes/mongodbRoutes/profile.js');
const googlelogin = require('./helpers/google-login.js');
const chatRoutes = require('./routes/mongodbRoutes/chat.js');

// Routes for MySQL database
app.use(`${api}/users`, authJwt(), usersRoutes);
app.use(`${api}/profile`, authJwt(), profileRoutes);
app.use(`${api}/message`, authJwt(), chatRoutes);
app.use(`${api}`, googlelogin);

// WebSocket connection handling
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

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://${getLocalIP()}:${PORT}/`);
});

// Function to get local IP
function getLocalIP() {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceKey in networkInterfaces) {
    const iface = networkInterfaces[interfaceKey];
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
}


// app.listen(PORT, ()=> {
//   console.log(`server running at http`)
// })