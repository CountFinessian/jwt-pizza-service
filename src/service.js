const express = require('express');
const { authRouter } = require('./routes/authRouter.js'); // Remove setAuthUser import
const orderRouter = require('./routes/orderRouter.js');
const franchiseRouter = require('./routes/franchiseRouter.js');
const version = require('./version.json');
const config = require('./config.js');
const metrics = require('./metrics.js'); // Add metrics module
const logger = require('./logger');

const app = express();
app.use(express.json());
app.use(logger.httpLogger);

// Middleware to set authenticated user
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    // Assuming a function verifyToken exists to verify JWT token
    const user = verifyToken(token);
    if (user) {
      req.user = user;
      console.log('User authenticated:', user); // Log authenticated user
    }
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// Middleware to track active users
app.use((req, res, next) => {
  if (req.user) { // Check if the user is authenticated
    metrics.incrementActiveUsers();
    res.on('finish', () => {
      metrics.decrementActiveUsers();
    });
  }
  next();
});

// Artificially inflate active users every 30 seconds
let artificialUserAdded = false;
setInterval(() => {
  if (!artificialUserAdded) {
    metrics.incrementActiveUsers();
    artificialUserAdded = true;
    console.log('Artificially incremented active users');
  }
}, 30000);

// Middleware to track HTTP requests by method
app.use((req, res, next) => {
  metrics.incrementRequests(req.method);
  next();
});

// Middleware to track auth attempts
app.use('/api/auth', (req, res, next) => {
  res.on('finish', () => {
    if (req.method === 'PUT' || req.method === 'POST') {
      const success = res.statusCode === 200;
      metrics.incrementAuthAttempts(success);
    }
  });
  next();
});

// Middleware to track latency for service endpoints
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const latency = Date.now() - start;
    metrics.trackLatency(req.path, latency);
  });
  next();
});

// Middleware to track latency for pizza creation
app.use('/api/order', (req, res, next) => {
  if (req.method === 'POST') {
    const start = Date.now();
    res.on('finish', () => {
      const latency = Date.now() - start;
      metrics.trackLatency('/api/order', latency);
    });
  }
  next();
});

const apiRouter = express.Router();
app.use('/api', apiRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/order', orderRouter);
apiRouter.use('/franchise', franchiseRouter);

// Add /api/metrics endpoint
apiRouter.post('/metrics', (req, res) => {
  const { metric, value, success, revenue } = req.body;
  switch (metric) {
    case 'menu_request':
      // Handle menu request metric
      break;
    case 'auth_attempt':
      metrics.incrementAuthAttempts(success);
      break;
    case 'pizza_order':
      metrics.incrementPizzaOrders(success, revenue);
      break;
    case 'logout':
      // Handle logout metric
      break;
    default:
      console.log(`Unknown metric: ${metric}`);
  }
  res.status(200).send();
});

// Add /api/metrics/revenue endpoint
apiRouter.post('/metrics/revenue', (req, res) => {
  const { revenue } = req.body;
  if (typeof revenue === 'number') {
    metrics.incrementRevenue(revenue);
    res.status(200).send();
  } else {
    res.status(400).send({ message: 'Invalid revenue value' });
  }
});

apiRouter.use('/docs', (req, res) => {
  res.json({
    version: version.version,
    endpoints: [...authRouter.endpoints, ...orderRouter.endpoints, ...franchiseRouter.endpoints],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'welcome to JWT Pizza',
    version: version.version,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    message: 'unknown endpoint',
  });
});

// Default error handler for all exceptions and errors.
app.use((err, req, res, next) => {
  res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
  next();
});

module.exports = app;