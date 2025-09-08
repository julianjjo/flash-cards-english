#!/usr/bin/env node

/**
 * Real-time Test Monitoring and Analytics Dashboard
 * 
 * This script provides real-time monitoring of test execution with:
 * - Live test progress tracking
 * - Performance metrics collection
 * - Resource usage monitoring
 * - Failure detection and alerting
 * - Test execution analytics
 * - WebSocket-based dashboard updates
 */

import fs from 'fs/promises';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestMonitor {
  constructor() {
    this.httpServer = null;
    this.wsServer = null;
    this.clients = new Set();
    this.monitoring = {
      isActive: false,
      startTime: null,
      currentSuite: null,
      metrics: {
        totalTests: 0,
        completedTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        avgTestDuration: 0,
        memoryUsage: [],
        cpuUsage: [],
        networkActivity: []
      },
      suites: {},
      failures: [],
      performance: {
        slowestTests: [],
        fastestTests: [],
        memoryLeaks: [],
        performanceIssues: []
      }
    };

    this.config = {
      port: 8080,
      updateInterval: 1000, // 1 second
      maxMetricsHistory: 300, // 5 minutes of data
      performanceThresholds: {
        testTimeout: 30000, // 30 seconds
        memoryLeakThreshold: 100 * 1024 * 1024, // 100MB
        cpuThreshold: 80 // 80%
      }
    };
  }

  async start(options = {}) {
    this.config = { ...this.config, ...options };
    
    console.log('🔍 Starting Test Monitor Dashboard...');
    
    try {
      await this.createHttpServer();
      await this.createWebSocketServer();
      await this.startSystemMonitoring();
      
      console.log(`📊 Test Monitor Dashboard running at:`);
      console.log(`   HTTP: http://localhost:${this.config.port}`);
      console.log(`   WebSocket: ws://localhost:${this.config.port}`);
      console.log('\n🎯 Ready to monitor test executions\n');
      
      // Keep the process running
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('❌ Failed to start Test Monitor:', error.message);
      process.exit(1);
    }
  }

  async createHttpServer() {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer(async (req, res) => {
        await this.handleHttpRequest(req, res);
      });

      this.httpServer.listen(this.config.port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async createWebSocketServer() {
    this.wsServer = new WebSocketServer({ server: this.httpServer });

    this.wsServer.on('connection', (ws, req) => {
      console.log('📱 New dashboard client connected');
      
      this.clients.add(ws);

      // Send initial data
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.monitoring
      }));

      ws.on('close', () => {
        console.log('📱 Dashboard client disconnected');
        this.clients.delete(ws);
      });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error.message);
        }
      });
    });
  }

  async handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${this.config.port}`);
    
    try {
      if (url.pathname === '/') {
        await this.serveDashboard(res);
      } else if (url.pathname === '/api/status') {
        await this.serveStatus(res);
      } else if (url.pathname === '/api/metrics') {
        await this.serveMetrics(res);
      } else if (url.pathname === '/api/start-monitoring') {
        await this.startMonitoring(res);
      } else if (url.pathname === '/api/stop-monitoring') {
        await this.stopMonitoring(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    } catch (error) {
      console.error('HTTP request error:', error.message);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  async serveDashboard(res) {
    const dashboardHtml = await this.generateDashboardHTML();
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(dashboardHtml);
  }

  async serveStatus(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      monitoring: this.monitoring.isActive,
      uptime: Date.now() - (this.monitoring.startTime || Date.now()),
      clients: this.clients.size
    }));
  }

  async serveMetrics(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.monitoring));
  }

  async startMonitoring(res) {
    this.monitoring.isActive = true;
    this.monitoring.startTime = Date.now();
    
    console.log('🎬 Test monitoring started');
    this.broadcastUpdate('monitoring-started');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async stopMonitoring(res) {
    this.monitoring.isActive = false;
    
    console.log('🎬 Test monitoring stopped');
    this.broadcastUpdate('monitoring-stopped');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  }

  async handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'start-tests':
        await this.startTestExecution(data.config);
        break;
      case 'stop-tests':
        await this.stopTestExecution();
        break;
      case 'get-logs':
        await this.sendLogs(ws, data.filter);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  async startSystemMonitoring() {
    setInterval(() => {
      if (this.monitoring.isActive) {
        this.collectSystemMetrics();
        this.broadcastUpdate('metrics-update');
      }
    }, this.config.updateInterval);
  }

  async collectSystemMetrics() {
    try {
      // Memory usage
      const memoryUsage = process.memoryUsage();
      this.monitoring.metrics.memoryUsage.push({
        timestamp: Date.now(),
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      });

      // Keep only recent metrics
      if (this.monitoring.metrics.memoryUsage.length > this.config.maxMetricsHistory) {
        this.monitoring.metrics.memoryUsage.shift();
      }

      // CPU usage (simplified)
      const cpuUsage = await this.getCPUUsage();
      this.monitoring.metrics.cpuUsage.push({
        timestamp: Date.now(),
        usage: cpuUsage
      });

      if (this.monitoring.metrics.cpuUsage.length > this.config.maxMetricsHistory) {
        this.monitoring.metrics.cpuUsage.shift();
      }

      // Check for performance issues
      await this.checkPerformanceIssues();

    } catch (error) {
      console.error('Error collecting system metrics:', error.message);
    }
  }

  async getCPUUsage() {
    return new Promise((resolve) => {
      exec('ps -o pcpu= -p ' + process.pid, (error, stdout) => {
        if (error) {
          resolve(0);
        } else {
          const cpu = parseFloat(stdout.trim()) || 0;
          resolve(cpu);
        }
      });
    });
  }

  async checkPerformanceIssues() {
    const latestMemory = this.monitoring.metrics.memoryUsage.slice(-1)[0];
    const latestCPU = this.monitoring.metrics.cpuUsage.slice(-1)[0];

    // Memory leak detection
    if (latestMemory && latestMemory.heapUsed > this.config.performanceThresholds.memoryLeakThreshold) {
      const issue = {
        type: 'memory-leak',
        timestamp: Date.now(),
        severity: 'high',
        message: `High memory usage detected: ${Math.round(latestMemory.heapUsed / 1024 / 1024)}MB`,
        value: latestMemory.heapUsed
      };
      
      this.monitoring.performance.memoryLeaks.push(issue);
      this.broadcastUpdate('performance-issue', issue);
    }

    // High CPU usage
    if (latestCPU && latestCPU.usage > this.config.performanceThresholds.cpuThreshold) {
      const issue = {
        type: 'high-cpu',
        timestamp: Date.now(),
        severity: 'medium',
        message: `High CPU usage: ${latestCPU.usage}%`,
        value: latestCPU.usage
      };
      
      this.monitoring.performance.performanceIssues.push(issue);
      this.broadcastUpdate('performance-issue', issue);
    }
  }

  async startTestExecution(config) {
    console.log('🚀 Starting test execution via monitor...');
    
    this.monitoring.isActive = true;
    this.monitoring.startTime = Date.now();
    
    // Reset metrics
    this.monitoring.metrics.totalTests = 0;
    this.monitoring.metrics.completedTests = 0;
    this.monitoring.metrics.passedTests = 0;
    this.monitoring.metrics.failedTests = 0;
    this.monitoring.metrics.skippedTests = 0;
    
    this.broadcastUpdate('test-execution-started', config);
    
    // Start test runner in subprocess
    const testRunnerPath = path.join(__dirname, 'test-runner.js');
    const args = this.buildTestRunnerArgs(config);
    
    const child = spawn('node', [testRunnerPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    child.stdout.on('data', (data) => {
      this.parseTestOutput(data.toString());
    });

    child.stderr.on('data', (data) => {
      console.error('Test execution error:', data.toString());
      this.broadcastUpdate('test-error', data.toString());
    });

    child.on('close', (code) => {
      console.log(`Test execution completed with code ${code}`);
      this.monitoring.isActive = false;
      this.broadcastUpdate('test-execution-completed', { code });
    });
  }

  buildTestRunnerArgs(config) {
    const args = [];
    
    if (config.suites && config.suites.length > 0) {
      args.push('--suites', config.suites.join(','));
    }
    
    if (config.browsers && config.browsers.length > 0) {
      args.push('--browsers', config.browsers.join(','));
    }
    
    if (config.grep) {
      args.push('--grep', config.grep);
    }
    
    if (config.headed) {
      args.push('--headed');
    }
    
    if (config.debug) {
      args.push('--debug');
    }
    
    if (!config.parallel) {
      args.push('--serial');
    }
    
    if (config.workers) {
      args.push('--workers', config.workers.toString());
    }
    
    if (config.retries) {
      args.push('--retries', config.retries.toString());
    }
    
    return args;
  }

  parseTestOutput(output) {
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Parse different types of test output
      if (line.includes('Running')) {
        const match = line.match(/Running (\w+) tests/);
        if (match) {
          this.monitoring.currentSuite = match[1];
          this.broadcastUpdate('suite-started', match[1]);
        }
      } else if (line.includes('passed')) {
        const match = line.match(/(\d+)\s+passed/);
        if (match) {
          this.monitoring.metrics.passedTests += parseInt(match[1]);
          this.broadcastUpdate('test-passed');
        }
      } else if (line.includes('failed')) {
        const match = line.match(/(\d+)\s+failed/);
        if (match) {
          this.monitoring.metrics.failedTests += parseInt(match[1]);
          this.broadcastUpdate('test-failed');
        }
      } else if (line.includes('skipped')) {
        const match = line.match(/(\d+)\s+skipped/);
        if (match) {
          this.monitoring.metrics.skippedTests += parseInt(match[1]);
          this.broadcastUpdate('test-skipped');
        }
      }
      
      // Track test completion
      this.monitoring.metrics.completedTests = 
        this.monitoring.metrics.passedTests + 
        this.monitoring.metrics.failedTests + 
        this.monitoring.metrics.skippedTests;
    }
  }

  broadcastUpdate(type, data = null) {
    const message = JSON.stringify({
      type,
      timestamp: Date.now(),
      data: data || this.monitoring
    });

    this.clients.forEach(client => {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending WebSocket message:', error.message);
        this.clients.delete(client);
      }
    });
  }

  async generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flash Cards Test Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #1a1a1a; 
            color: #fff; 
            overflow-x: auto;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 { color: white; font-size: 1.8rem; }
        .status { 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-size: 0.9rem;
            font-weight: bold;
        }
        .status.running { background: #48bb78; }
        .status.stopped { background: #f56565; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .card { 
            background: #2d2d2d; 
            border-radius: 12px; 
            padding: 20px; 
            border: 1px solid #404040;
        }
        .card h3 { margin-bottom: 15px; color: #ffffff; font-size: 1.1rem; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .metric { 
            background: #3a3a3a; 
            padding: 15px; 
            border-radius: 8px; 
            text-align: center;
        }
        .metric-value { font-size: 2rem; font-weight: bold; margin-bottom: 5px; }
        .metric-label { font-size: 0.9rem; color: #ccc; }
        .metric.passed .metric-value { color: #48bb78; }
        .metric.failed .metric-value { color: #f56565; }
        .metric.skipped .metric-value { color: #ed8936; }
        .metric.total .metric-value { color: #4299e1; }
        .chart { height: 200px; background: #3a3a3a; border-radius: 8px; margin-top: 15px; position: relative; }
        .controls { 
            display: flex; 
            gap: 10px; 
            margin-bottom: 20px; 
            flex-wrap: wrap;
        }
        .btn { 
            background: #4299e1; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 6px; 
            cursor: pointer;
            font-size: 0.9rem;
        }
        .btn:hover { background: #3182ce; }
        .btn:disabled { background: #666; cursor: not-allowed; }
        .btn.danger { background: #f56565; }
        .btn.danger:hover { background: #e53e3e; }
        .log { 
            background: #2d2d2d; 
            border-radius: 12px; 
            padding: 20px; 
            border: 1px solid #404040;
            height: 300px;
            overflow-y: auto;
        }
        .log-entry { 
            padding: 5px 0; 
            font-family: 'Courier New', monospace; 
            font-size: 0.85rem;
            border-bottom: 1px solid #404040;
        }
        .log-entry:last-child { border-bottom: none; }
        .log-entry.error { color: #f56565; }
        .log-entry.success { color: #48bb78; }
        .log-entry.info { color: #4299e1; }
        .progress-bar { 
            width: 100%; 
            height: 8px; 
            background: #404040; 
            border-radius: 4px; 
            overflow: hidden; 
            margin: 10px 0;
        }
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #48bb78 0%, #4299e1 100%); 
            transition: width 0.3s ease;
            width: 0%;
        }
        .full-width { grid-column: 1 / -1; }
        @media (max-width: 768px) {
            .grid { grid-template-columns: 1fr; }
            .controls { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Flash Cards Test Monitor</h1>
            <div class="status stopped" id="status">Stopped</div>
        </div>

        <div class="controls">
            <button class="btn" onclick="startMonitoring()">Start Monitoring</button>
            <button class="btn danger" onclick="stopMonitoring()">Stop Monitoring</button>
            <button class="btn" onclick="runTests()">Run All Tests</button>
            <button class="btn" onclick="runContractTests()">Contract Tests</button>
            <button class="btn" onclick="runJourneyTests()">Journey Tests</button>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📊 Test Progress</h3>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress"></div>
                </div>
                <div class="metrics-grid">
                    <div class="metric total">
                        <div class="metric-value" id="total-tests">0</div>
                        <div class="metric-label">Total</div>
                    </div>
                    <div class="metric passed">
                        <div class="metric-value" id="passed-tests">0</div>
                        <div class="metric-label">Passed</div>
                    </div>
                    <div class="metric failed">
                        <div class="metric-value" id="failed-tests">0</div>
                        <div class="metric-label">Failed</div>
                    </div>
                    <div class="metric skipped">
                        <div class="metric-value" id="skipped-tests">0</div>
                        <div class="metric-label">Skipped</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>📈 System Performance</h3>
                <div class="metrics-grid">
                    <div class="metric">
                        <div class="metric-value" id="memory-usage">0</div>
                        <div class="metric-label">Memory (MB)</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="cpu-usage">0</div>
                        <div class="metric-label">CPU (%)</div>
                    </div>
                </div>
                <div class="chart" id="performance-chart"></div>
            </div>
        </div>

        <div class="card full-width">
            <h3>📝 Real-time Logs</h3>
            <div class="log" id="log-container"></div>
        </div>
    </div>

    <script>
        let ws = null;
        let monitoring = { isActive: false, metrics: { totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0 } };

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(\`\${protocol}//\${window.location.host}\`);

            ws.onopen = () => {
                addLog('Connected to test monitor', 'success');
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            };

            ws.onclose = () => {
                addLog('Disconnected from test monitor', 'error');
                setTimeout(connectWebSocket, 2000); // Reconnect
            };

            ws.onerror = (error) => {
                addLog('WebSocket error', 'error');
            };
        }

        function handleWebSocketMessage(message) {
            switch (message.type) {
                case 'initial':
                case 'metrics-update':
                    updateDashboard(message.data);
                    break;
                case 'monitoring-started':
                    updateStatus(true);
                    addLog('Test monitoring started', 'success');
                    break;
                case 'monitoring-stopped':
                    updateStatus(false);
                    addLog('Test monitoring stopped', 'info');
                    break;
                case 'test-execution-started':
                    addLog('Test execution started', 'success');
                    break;
                case 'test-execution-completed':
                    addLog(\`Test execution completed (code: \${message.data.code})\`, message.data.code === 0 ? 'success' : 'error');
                    break;
                case 'suite-started':
                    addLog(\`Started \${message.data} test suite\`, 'info');
                    break;
                case 'test-passed':
                    addLog('Test passed', 'success');
                    break;
                case 'test-failed':
                    addLog('Test failed', 'error');
                    break;
                case 'performance-issue':
                    addLog(\`Performance issue: \${message.data.message}\`, 'error');
                    break;
            }
        }

        function updateDashboard(data) {
            monitoring = data;
            
            // Update metrics
            document.getElementById('total-tests').textContent = data.metrics.totalTests || 0;
            document.getElementById('passed-tests').textContent = data.metrics.passedTests || 0;
            document.getElementById('failed-tests').textContent = data.metrics.failedTests || 0;
            document.getElementById('skipped-tests').textContent = data.metrics.skippedTests || 0;

            // Update progress bar
            const total = data.metrics.totalTests || 1;
            const completed = (data.metrics.passedTests || 0) + (data.metrics.failedTests || 0) + (data.metrics.skippedTests || 0);
            const progress = (completed / total) * 100;
            document.getElementById('progress').style.width = \`\${progress}%\`;

            // Update system metrics
            const latestMemory = data.metrics.memoryUsage?.slice(-1)[0];
            const latestCPU = data.metrics.cpuUsage?.slice(-1)[0];
            
            if (latestMemory) {
                document.getElementById('memory-usage').textContent = Math.round(latestMemory.heapUsed / 1024 / 1024);
            }
            
            if (latestCPU) {
                document.getElementById('cpu-usage').textContent = Math.round(latestCPU.usage);
            }

            updateStatus(data.isActive);
        }

        function updateStatus(isActive) {
            const status = document.getElementById('status');
            status.textContent = isActive ? 'Running' : 'Stopped';
            status.className = \`status \${isActive ? 'running' : 'stopped'}\`;
        }

        function addLog(message, type = 'info') {
            const logContainer = document.getElementById('log-container');
            const entry = document.createElement('div');
            entry.className = \`log-entry \${type}\`;
            entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;

            // Keep only last 100 entries
            while (logContainer.children.length > 100) {
                logContainer.removeChild(logContainer.firstChild);
            }
        }

        async function startMonitoring() {
            const response = await fetch('/api/start-monitoring');
            if (response.ok) {
                addLog('Monitoring started', 'success');
            }
        }

        async function stopMonitoring() {
            const response = await fetch('/api/stop-monitoring');
            if (response.ok) {
                addLog('Monitoring stopped', 'info');
            }
        }

        function runTests() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'start-tests',
                    config: { suites: ['contracts', 'journeys', 'edge-cases', 'performance', 'accessibility'] }
                }));
            }
        }

        function runContractTests() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'start-tests',
                    config: { suites: ['contracts'] }
                }));
            }
        }

        function runJourneyTests() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'start-tests',
                    config: { suites: ['journeys'] }
                }));
            }
        }

        // Initialize
        connectWebSocket();
        
        // Update dashboard every second
        setInterval(async () => {
            try {
                const response = await fetch('/api/metrics');
                const data = await response.json();
                updateDashboard(data);
            } catch (error) {
                // Ignore fetch errors, WebSocket will handle updates
            }
        }, 1000);
    </script>
</body>
</html>`;
  }

  async stop() {
    console.log('\n🔄 Shutting down Test Monitor...');
    
    this.clients.forEach(client => {
      try {
        client.close();
      } catch (error) {
        // Ignore close errors
      }
    });

    if (this.wsServer) {
      this.wsServer.close();
    }

    if (this.httpServer) {
      this.httpServer.close();
    }

    console.log('👋 Test Monitor stopped');
    process.exit(0);
  }
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--port':
        options.port = parseInt(nextArg) || 8080;
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
Flash Cards Test Monitor

Usage: node test-monitor.js [options]

Options:
  --port <number>     Port to run the dashboard on (default: 8080)
  -h, --help          Show this help message

The monitor provides:
  - Real-time test execution tracking
  - Performance metrics visualization  
  - System resource monitoring
  - Test failure analysis
  - WebSocket-based dashboard updates

Access the dashboard at: http://localhost:8080
        `);
        process.exit(0);
    }
  }

  const monitor = new TestMonitor();
  monitor.start(options);
}

export default TestMonitor;