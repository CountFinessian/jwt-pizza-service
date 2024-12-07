const config = require('./config.js');

// Define default config
const DEFAULT_CONFIG = {
  source: 'jwt-pizza-service',
  url: 'http://localhost:3000',
  userId: '',
  apiKey: ''
};

class Logger {
  constructor() {
    // Initialize with logging config from config.js
    this.config = config.logging;
    // Bind methods to preserve context
    this.httpLogger = this.httpLogger.bind(this);
    this.log = this.log.bind(this);
    this.createLogData = this.createLogData.bind(this);
  }

  // Add createLogData as a class method
  createLogData(req, res, body) {
    return {
      source: this.config.source,
      authorized: !!req.headers.authorization,
      path: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      operation: this.getOperationType(req),
      reqBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      resBody: typeof body === 'string' ? body : JSON.stringify(body),
      timestamp: new Date().toISOString()
    };
  }

  getOperationType(req) {
    const method = req.method.toLowerCase();
    switch (method) {
      case 'get': return 'read';
      case 'post': return 'create';
      case 'put': return 'update';
      case 'delete': return 'delete';
      default: return method;
    }
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    if (!logData) return logData;
    const sanitized = JSON.stringify(logData);
    return sanitized.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  }

  async sendLogToGrafana(event) {
    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        body: JSON.stringify(event),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.userId}:${this.config.apiKey}`
        }
      });
      if (!response.ok) {
        console.error('Failed to send log to Grafana:', await response.text());
      }
    } catch (err) {
      console.error('Error sending log to Grafana:', err);
    }
  }

  log(level, type, data) {
    const labels = { 
      component: this.config.source, 
      level, 
      type 
    };
    const values = [this.nowString(), this.sanitize(data)];
    const logEvent = { 
      streams: [{ 
        stream: labels, 
        values: [values] 
      }]
    };

    this.sendLogToGrafana(logEvent);
  }

  configure(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  httpLogger(req, res, next) {
    try {
      const oldEnd = res.end;
      const oldSend = res.send;
      const oldJson = res.json;
      const self = this;

      // Log request start
      this.log('info', 'http', {
        event: 'request_start',
        path: req.originalUrl,
        method: req.method,
        operation: this.getOperationType(req)
      });

      res.end = function(chunk) {  // Remove unused 'encoding' parameter
        try {
          const body = chunk ? chunk.toString() : '';
          const logData = self.createLogData(req, res, body);
          const level = self.statusToLogLevel(res.statusCode);
          self.log(level, 'http', { ...logData, event: 'request_end' });
        } catch (err) {
          console.error('Logging error in end:', err);
        }
        return oldEnd.apply(this, arguments);
      };

      res.send = function(body) {
        try {
          const logData = self.createLogData(req, res, body);
          const level = self.statusToLogLevel(res.statusCode);
          self.log(level, 'http', logData);
        } catch (err) {
          console.error('Logging error in send:', err);
        }
        return oldSend.apply(this, arguments);
      };

      res.json = function(body) {
        try {
          const logData = self.createLogData(req, res, body);
          const level = self.statusToLogLevel(res.statusCode);
          self.log(level, 'http', logData);
        } catch (err) {
          console.error('Logging error in json:', err);
        }
        return oldJson.apply(this, arguments);
      };

      next();
    } catch (err) {
      console.error('Error in httpLogger:', err);
      next(err);
    }
  }
}

const logger = new Logger();
module.exports = logger;