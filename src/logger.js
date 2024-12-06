const fetch = require('node-fetch');
const config = require('./config.js');

class Logger {
  httpLogger = (req, res, next) => {
    const originalSend = res.send;
    res.send = (body) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: this.sanitize(req.body),
        resBody: this.sanitize(body)
      };
      const level = this.getLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = originalSend;
      return res.send(body);
    };
    next();
  };

  dbLogger(query) {
    const logData = { query: this.sanitize(query) };
    this.log('info', 'db', logData);
  }

  factoryLogger(requestData) {
    const logData = this.sanitize(requestData);
    this.log('info', 'factory', logData);
  }

  unhandledErrorLogger(error) {
    const logData = {
      message: error.message,
      stack: error.stack,
      code: error.code || 500
    };
    this.log('error', 'exception', logData);
  }

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [[this.getCurrentTime(), JSON.stringify(logData)]];
    const logEvent = { streams: [{ stream: labels, values: values }] };
    this.sendLogToGrafana(logEvent);
  }

  getLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  getCurrentTime() {
    return (Date.now() * 1e6).toString();
  }

  sanitize(data) {
    const dataStr = JSON.stringify(data);
    return dataStr
      .replace(/"password":\s*"[^"]*"/g, '"password":"*****"')
      .replace(/"apiKey":\s*"[^"]*"/g, '"apiKey":"*****"')
      .replace(/"authorization":\s*"[^"]*"/g, '"authorization":"*****"')
      .replace(/"token":\s*"[^"]*"/g, '"token":"*****"');
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.logging.userId}:${config.logging.apiKey}`
      }
    }).then(res => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    }).catch(err => {
      console.error('Error sending log to Grafana:', err);
    });
  }
}

function metricsLogger(metrics) {
  console.log('[METRICS]', JSON.stringify(metrics, null, 2));
}

module.exports = new Logger();
module.exports.metricsLogger = metricsLogger;