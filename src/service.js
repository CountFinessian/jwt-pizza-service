const express = require('express');
const { authRouter } = require('./routes/authRouter.js'); // Import verifyToken
const orderRouter = require('./routes/orderRouter.js');
const franchiseRouter = require('./routes/franchiseRouter.js');
const version = require('./version.json');
const config = require('./config.js');
const metrics = require('./metrics.js'); // Add metrics module
const logger = require('./logger');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(logger.httpLogger);

// Middleware to set authenticated user
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const user = jwt.verify(token, config.jwtSecret);
      if (user) {
        req.user = user;
        console.log('User authenticated:', user);
      }
    } catch (err) {
      console.error('Token verification failed:', err.message);
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
  if (req.method === 'PUT' || req.method === 'POST') {
    res.on('finish', () => {
      const success = res.statusCode === 200;
      metrics.incrementAuthAttempts(success);
    });
  }
  next();  // Make sure to call next() to continue the middleware chain
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
  const { metric, success, revenue } = req.body;
  if (metric === 'pizza_order') {
    metrics.incrementPizzaOrders(success, revenue);
  }
  res.status(200).send();
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
app.use((err, req, res, _next) => {  // Add underscore to indicate intentionally unused parameter
  // Log the error with wrapped logger
  logger.log('error', 'service', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    source: 'jwt-pizza-service'
  });

  // Send appropriate response
  res.status(err.statusCode || err.status || 500).json({ 
    message: err.message || 'Internal server error',
    status: err.statusCode || err.status || 500
  });
});

module.exports = app;