require('dotenv/config');
// const fs = require('fs');
// const https = require('https');
const api = process.env.API_URL;
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { authJwt } = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const bodyParser = require('body-parser');
const connectToDatabaseMongoose = require('./config/mongoose.js');

// SSL certificate paths (Update with your actual certificate and key paths)
// const privateKey = fs.readFileSync('/home/ubuntu/ssl/private-key.pem', 'utf8');
// const certificate = fs.readFileSync('/home/ubuntu/ssl/certificate.pem', 'utf8');
// const ca = fs.readFileSync('/path/to/your/ca_bundle.crt', 'utf8');

// const credentials = { key: privateKey, cert: certificate};

connectToDatabaseMongoose();

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.use(
  cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })
);
app.use(express.json());
app.options('*', cors());

app.use(morgan('tiny'));
app.use(`${api}/uploads`, express.static(path.join(__dirname, 'uploads')));
app.use(errorHandler);

const usersRoutes = require('./routes/mongodbRoutes/users.js');
const profileRoutes = require('./routes/mongodbRoutes/profile.js');
const googlelogin = require('./helpers/google-login.js');



app.use(`${api}/users`, authJwt(), usersRoutes);
app.use(`${api}/profile`, authJwt(), profileRoutes);
app.use(`${api}`, googlelogin);
app.use(`/testing`, (req, res) => {
  res.send('Welcome to API');
});

// Start HTTPS server
const PORT = process.env.PORT || 4100; // HTTPS default port
// const httpsServer = https.createServer(credentials, app);

app.listen(PORT, () => {
  console.log(`HTTPS Server running at https://localhost:${PORT}`);
});
