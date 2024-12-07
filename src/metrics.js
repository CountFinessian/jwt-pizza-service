const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js');
const logger = require('./logger.js');

function getCpuUsagePercentage() {
  return new Promise((resolve) => {
    const startMeasure = cpuAverage();
    setTimeout(() => {
      const endMeasure = cpuAverage();
      const idleDifference = endMeasure.idle - startMeasure.idle;
      const totalDifference = endMeasure.total - startMeasure.total;
      const percentageCpu = 100 - ~~(100 * idleDifference / totalDifference);
      resolve(percentageCpu.toFixed(2));
    }, 1000);
  });
}

function cpuAverage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

class Metrics {
  constructor() {
    // Initialize counters
    this.counters = {
      requests: {
        GET: 0,
        POST: 0,
        PUT: 0,
        DELETE: 0,
      },
      users: {
        active: 0,
      },
      auth: {
        successful: 0,
        failed: 0,
      },
      orders: {
        successful: 0,
        failed: 0,
        revenue: 0,
      }
    };

    // Start metrics reporting
    this.startMetricsReporting();
  }

  startMetricsReporting() {
    const reportInterval = setInterval(async () => {
      try {
        await this.reportMetrics();
      } catch (error) {
        logger.log('error', 'metrics', { 
          error: error.message,
          operation: 'reportMetrics'
        });
      }
    }, 10000);
    reportInterval.unref();
  }

  async reportMetrics() {
    const metrics = [];
    const timestamp = Date.now();

    // System metrics
    metrics.push(this.createMetric('system_cpu_usage', await getCpuUsagePercentage(), timestamp));
    metrics.push(this.createMetric('system_memory_usage', getMemoryUsagePercentage(), timestamp));

    // Request metrics
    Object.entries(this.counters.requests).forEach(([method, count]) => {
      metrics.push(this.createMetric(`http_requests_total{method="${method}"}`, count, timestamp));
    });

    // User metrics
    metrics.push(this.createMetric('active_users', this.counters.users.active, timestamp));

    // Auth metrics
    metrics.push(this.createMetric('auth_attempts_successful', this.counters.auth.successful, timestamp));
    metrics.push(this.createMetric('auth_attempts_failed', this.counters.auth.failed, timestamp));

    // Order metrics
    metrics.push(this.createMetric('orders_successful', this.counters.orders.successful, timestamp));
    metrics.push(this.createMetric('orders_failed', this.counters.orders.failed, timestamp));
    metrics.push(this.createMetric('orders_revenue', this.counters.orders.revenue, timestamp));

    await this.sendMetricsToGrafana(metrics);
  }

  createMetric(name, value, timestamp) {
    return {
      name,
      value: Number(value),
      timestamp
    };
  }

  async sendMetricsToGrafana(metrics) {
    try {
      const response = await fetch(config.metrics.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`
        },
        body: JSON.stringify(metrics)
      });

      if (!response.ok) {
        throw new Error(`Failed to send metrics: ${response.status}`);
      }
    } catch (error) {
      logger.log('error', 'metrics', {
        error: error.message,
        operation: 'sendMetrics'
      });
    }
  }

  // Public API methods
  incrementRequests(method) {
    if (method in this.counters.requests) {
      this.counters.requests[method]++;
    }
  }

  incrementActiveUsers() {
    this.counters.users.active++;
  }

  decrementActiveUsers() {
    this.counters.users.active = Math.max(0, this.counters.users.active - 1);
  }

  recordAuthAttempt(success) {
    if (success) {
      this.counters.auth.successful++;
    } else {
      this.counters.auth.failed++;
    }
  }

  recordOrder(success, revenue = 0) {
    if (success) {
      this.counters.orders.successful++;
      this.counters.orders.revenue += Number(revenue);
    } else {
      this.counters.orders.failed++;
    }
  }
}

// Export a singleton instance
const metrics = new Metrics();
module.exports = metrics;