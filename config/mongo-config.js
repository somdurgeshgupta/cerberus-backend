const dns = require('node:dns');

function configureMongoDns() {
  const configuredServers = process.env.MONGODB_DNS_SERVERS;

  if (!configuredServers) {
    return;
  }

  const servers = configuredServers
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    dns.setServers(servers);
  }
}

function getMongoUri() {
  const directUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (directUri) {
    return directUri;
  }

  const connectionString = process.env.CONNECTION_STRING;
  const dbName = process.env.DBNAME;

  if (!connectionString) {
    throw new Error('Missing MongoDB connection string. Set MONGODB_URI or CONNECTION_STRING in .env.');
  }

  if (!dbName) {
    throw new Error('Missing MongoDB database name. Set DBNAME in .env.');
  }

  const uri = new URL(connectionString);
  const normalizedDbName = dbName.replace(/^\/+/, '');
  uri.pathname = `/${normalizedDbName}`;

  return uri.toString();
}

function redactMongoUri(uri) {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^@/]+)@/i, '$1<credentials>@');
}

module.exports = {
  configureMongoDns,
  getMongoUri,
  redactMongoUri
};
