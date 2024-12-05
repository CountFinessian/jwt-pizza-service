const os = require('os');
const fetch = require('node-fetch');
const config = require('./config.js');

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
    this.totalRequests = {
      GET: 0,
      POST: 0,
      PUT: 0,
      DELETE: 0,
    };
    this.activeUsers = 0;
    this.authAttempts = {
      successful: 0,
      failed: 0,
    };
    this.pizzaOrders = {
      successful: 0,
      failed: 0,
      revenue: 0,
    };
    this.pizzasSoldPerMinute = 0;
    this.creationFailures = 0;
    this.revenuePerMinute = 0;
    this.totalRevenue = 0;
    this.endpointLatencies = {};
    this.pizzaCreationLatencies = [];
    this.latencies = {};

    // Send metrics to Grafana every 10 seconds
    const timer = setInterval(async () => {
      console.log('Sending metrics to Grafana...');
      for (const [method, count] of Object.entries(this.totalRequests)) {
        this.sendMetricToGrafana('request', method, 'total', count);
      }
      const cpuUsage = await getCpuUsagePercentage();
      this.sendMetricToGrafana('system', 'cpu', 'usage', cpuUsage);
      this.sendMetricToGrafana('system', 'memory', 'usage', getMemoryUsagePercentage());
      this.sendMetricToGrafana('user', 'active_users', 'count', this.activeUsers);
      this.sendMetricToGrafana('auth', 'successful_attempts', 'count', this.authAttempts.successful);
      this.sendMetricToGrafana('auth', 'failed_attempts', 'count', this.authAttempts.failed);
      this.sendMetricToGrafana('pizza', 'sold_per_minute', 'count', this.pizzasSoldPerMinute);
      this.sendMetricToGrafana('pizza', 'revenue_per_minute', 'amount', this.revenuePerMinute);
      this.sendMetricToGrafana('pizza', 'creation_failures', 'count', this.creationFailures);

      // Reset per minute metrics
      this.pizzasSoldPerMinute = 0;
      this.revenuePerMinute = 0;
    }, 60000); // Every 60 seconds

    timer.unref();
  }

  incrementRequests(method) {
    if (this.totalRequests[method] !== undefined) {
      this.totalRequests[method]++;
    }
  }

  incrementActiveUsers() {
    this.activeUsers++;
    console.log(`Active users incremented: ${this.activeUsers}`);
  }

  decrementActiveUsers() {
    this.activeUsers--;
    console.log(`Active users decremented: ${this.activeUsers}`);
  }

  incrementAuthAttempts(success) {
    if (success) {
      this.authAttempts.successful++;
    } else {
      this.authAttempts.failed++;
    }
  }

  incrementPizzaOrders(success, revenue) {
    if (success) {
      this.pizzaOrders.successful++;
      this.pizzaOrders.revenue += revenue;
      this.pizzasSoldPerMinute++;
      this.revenuePerMinute += revenue;
      this.totalRevenue += revenue;
    } else {
      this.pizzaOrders.failed++;
      this.creationFailures++;
    }
    console.log(`Pizza orders updated: ${JSON.stringify(this.pizzaOrders)}`);
  }

  incrementRevenue(amount) {
    this.totalRevenue += amount;
    this.sendMetricToGrafana('revenue', 'total', 'amount', this.totalRevenue);
    console.log(`Total revenue updated: ${this.totalRevenue}`);
  }

  trackLatency(endpoint, latency) {
    if (!this.latencies[endpoint]) {
      this.latencies[endpoint] = [];
    }
    this.latencies[endpoint].push(latency);
    this.sendMetricToGrafana('latency', 'endpoint', endpoint, latency);
    console.log(`Latency for ${endpoint}: ${latency}ms`);
  }

  trackPizzaCreationLatency(latency) {
    this.pizzaCreationLatencies.push(latency);
    this.sendMetricToGrafana('latency', 'pizza_creation', 'latency', latency);
    console.log(`Pizza creation latency: ${latency}ms`);
  }

  sendMetricToGrafana(metricPrefix, type, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.metrics.source},type=${type} ${metricName}=${metricValue}`;
    const url = new URL(config.metrics.url); // Ensure the URL is absolute
    console.log(`Pushing metrics to URL: ${url.href}`); // Log the URL being used
    fetch(url.href, {
      method: 'post',
      body: metric,
      headers: {
        'Content-Type': 'text/plain', // Ensure the content type is set correctly
        Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;