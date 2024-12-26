// Import required modules
require('dotenv/config');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const {authJwt} = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const PORT = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const connectToDatabaseMongoose = require('./config/mongoose.js'); //mongodb connection

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

const api = process.env.API_URL;

app.use(`${api}/users`, authJwt(), usersRoutes);

// Routes for mysql database
// app.use(`${api}/mysql`, require('./routes/mysqlRoutes'));

// No authJwt middleware for testing route
// app.use(`${api}`,testing);


// Server
// app.listen(PORT,'0.0.0.0', () => {
//   console.log(`Server running at http://${getLocalIP()}:${PORT}/`);
// });


// function getLocalIP() {
//   const os = require('os');
//   const networkInterfaces = os.networkInterfaces();
//   for (const interfaceKey in networkInterfaces) {
//     const iface = networkInterfaces[interfaceKey];
//     for (const alias of iface) {
//       if (alias.family === 'IPv4' && !alias.internal) {
//         return alias.address;
//       }
//     }
//   }
// }

app.listen(PORT, ()=>{
  console.log(`Server running at http://localhost:`,PORT)
})