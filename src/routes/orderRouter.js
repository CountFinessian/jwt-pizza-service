const express = require('express');
const config = require('../config.js');
const { Role, DB } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');
const { asyncHandler, StatusCodeError } = require('../endpointHelper.js');
const metrics = require('../metrics.js');
const logger = require('../logger.js');

const orderRouter = express.Router();

// Add JSON parsing error handler
orderRouter.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      message: 'Invalid JSON format in request body',
      details: err.message
    });
  }
  next(err);
});

orderRouter.endpoints = [
  {
    method: 'GET',
    path: '/api/order/menu',
    description: 'Get the pizza menu',
    example: `curl localhost:3000/api/order/menu`,
    response: [{ id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' }],
  },
  {
    method: 'PUT',
    path: '/api/order/menu',
    requiresAuth: true,
    description: 'Add an item to the menu',
    example: `curl -X PUT localhost:3000/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }'  -H 'Authorization: Bearer tttttt'`,
    response: [{ id: 1, title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 }],
  },
  {
    method: 'GET',
    path: '/api/order',
    requiresAuth: true,
    description: 'Get the orders for the authenticated user',
    example: `curl -X GET localhost:3000/api/order  -H 'Authorization: Bearer tttttt'`,
    response: { dinerId: 4, orders: [{ id: 1, franchiseId: 1, storeId: 1, date: '2024-06-05T05:14:40.000Z', items: [{ id: 1, menuId: 1, description: 'Veggie', price: 0.05 }] }], page: 1 },
  },
  {
    method: 'POST',
    path: '/api/order',
    requiresAuth: true,
    description: 'Create a order for the authenticated user',
    example: `curl -X POST localhost:3000/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H 'Authorization: Bearer tttttt'`,
    response: { order: { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }], id: 1 }, jwt: '1111111111' },
  },
];

// getMenu
orderRouter.get(
  '/menu',
  asyncHandler(async (req, res) => {
    try {
      const menu = await DB.getMenu();
      res.type('application/json').send(JSON.stringify(menu, null, 2));
    } catch (err) {
      logger.log('error', 'menu', { error: err.message });
      throw new StatusCodeError('Failed to retrieve menu', 500);
    }
  })
);

// addMenuItem
orderRouter.put(
  '/menu',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!req.user.isRole(Role.Admin)) {
      throw new StatusCodeError('unable to add menu item', 403);
    }

    const addMenuItemReq = req.body;
    await DB.addMenuItem(addMenuItemReq);
    res.send(await DB.getMenu());
  })
);

// getOrders
orderRouter.get(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    res.json(await DB.getOrders(req.user, req.query.page));
  })
);

// createOrder
orderRouter.post(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new StatusCodeError('Request body is empty or invalid', 400);
    }

    const orderReq = req.body;

    // More specific validation messages
    if (!orderReq.franchiseId) {
      throw new StatusCodeError('franchiseId is required', 400);
    }
    if (!orderReq.storeId) {
      throw new StatusCodeError('storeId is required', 400);
    }
    if (!Array.isArray(orderReq.items) || orderReq.items.length === 0) {
      throw new StatusCodeError('items must be a non-empty array', 400);
    }

    // Validate each item in the order
    for (const item of orderReq.items) {
      if (!item.menuId || !item.description || typeof item.price !== 'number') {
        throw new StatusCodeError('Each item must have menuId, description, and valid price', 400);
      }
    }

    const order = await DB.addDinerOrder(req.user, orderReq);
    // Calculate total revenue - ensure we're using decimal arithmetic
    const revenue = order.items.reduce((total, item) => total + Number(parseFloat(item.price)), 0);

    try {
      const requestBody = { diner: { id: req.user.id, name: req.user.name, email: req.user.email }, order };
      const r = await fetch(`${config.factory.url}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${config.factory.apiKey}` },
        body: JSON.stringify(requestBody)
      });
      
      const responseBody = await r.json();
      logger.log('info', 'factory', requestBody);

      if (r.ok) {
        // Track successful orders with revenue
        metrics.increment('orders.success', 1);
        metrics.increment('orders.revenue', revenue);
        logger.log('info', 'order', { 
          status: 'success', 
          orderId: order.id,
          revenue: revenue,
          items: order.items.length 
        });
        res.send({ order, jwt: responseBody.jwt, reportUrl: responseBody.reportUrl });
      } else {
        // Track failed orders
        metrics.increment('orders.failed', 1);
        throw new StatusCodeError(responseBody.message || 'Failed to fulfill order at factory', r.status);
      }
    } catch (error) {
      logger.log('error', 'order', { error: error.message, order });
      metrics.increment('orders.failed', 1);
      throw error;
    }
  })
);

// Add error handling middleware at the end
orderRouter.use((err, req, res, next) => {
  // Only handle JSON parsing errors here
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.log('warn', 'json-parse', { 
      error: err.message,
      path: req.path,
      method: req.method 
    });
    return res.status(400).json({ 
      message: 'Invalid JSON format in request body',
      details: err.message
    });
  }

  // Pass other errors to main error handler
  next(err);
});

module.exports = orderRouter;