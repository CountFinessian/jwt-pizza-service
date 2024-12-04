const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js');

class Metrics {
  constructor() {
    this.metricsBuffer = [];
  }

  requestTracker(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      this.metricsBuffer.push(`http_request_duration_seconds{method="${req.method}",status="${res.statusCode}"} ${duration / 1000}`);
      this.metricsBuffer.push(`http_requests_total{method="${req.method}",status="${res.statusCode}"} 1`);
    });
    next();
  }

  trackAuthAttempt(success) {
    this.metricsBuffer.push(`auth_attempts_total{success="${success}"} 1`);
  }

  trackActiveUser() {
    this.metricsBuffer.push(`active_users_total 1`);
  }

  trackPizzaOrder(success, revenue) {
    this.metricsBuffer.push(`pizza_orders_total{success="${success}"} 1`);
    if (success) {
      this.metricsBuffer.push(`pizza_revenue_total ${revenue}`);
      this.metricsBuffer.push(`pizzas_sold_total 1`);
    } else {
      this.metricsBuffer.push(`pizza_creation_failures_total 1`);
    }
  }

  trackSystemMetrics() {
    const cpuUsage = (os.loadavg()[0] / os.cpus().length) * 100;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;

    this.metricsBuffer.push(`system_cpu_usage_percentage ${cpuUsage.toFixed(2)}`);
    this.metricsBuffer.push(`system_memory_usage_percentage ${memoryUsage.toFixed(2)}`);
  }

  async sendMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const metrics = this.metricsBuffer.join('\n');
    this.metricsBuffer = [];

    await fetch(config.metrics.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${config.metrics.apiKey}`
      },
      body: `source=${config.metrics.source}&metrics=${encodeURIComponent(metrics)}`
    });
  }

  startPeriodicReporting(period = 60000) {
    setInterval(() => {
      this.trackSystemMetrics();
      this.sendMetrics().catch(console.error);
    }, period);
  }

  sendMetricsPeriodically(period) {
    setInterval(() => {
      try {
        this.trackSystemMetrics();
        this.sendMetrics().catch(console.error);
      } catch (error) {
        console.log('Error sending metrics', error);
      }
    }, period);
  }
}

const metrics = new Metrics();
metrics.startPeriodicReporting();
metrics.sendMetricsPeriodically();

module.exports = metrics;