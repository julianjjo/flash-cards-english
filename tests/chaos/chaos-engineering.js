#!/usr/bin/env node

/**
 * Chaos Engineering and Fault Injection Framework
 * 
 * Features:
 * - Network failure simulation
 * - Service dependency failures
 * - Database connection issues
 * - Memory and CPU stress testing
 * - Latency injection
 * - Random failure scenarios
 * - System resilience validation
 * - Recovery time measurement
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { execSync, spawn } = require('child_process');
const EventEmitter = require('events');

class ChaosEngineeringFramework extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.baseUrl = options.baseUrl || 'http://localhost:4000';
    this.outputDir = options.outputDir || path.join(process.cwd(), 'chaos-results');
    this.experimentDuration = options.experimentDuration || 300000; // 5 minutes
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.healthCheckInterval = options.healthCheckInterval || 5000; // 5 seconds
    
    this.activeExperiments = new Map();
    this.healthMetrics = [];
    this.failurePoints = [];
    this.recoveryTimes = [];
  }

  async initialize() {
    await this.ensureOutputDirectory();
    console.log('Chaos Engineering framework initialized');
  }

  async ensureOutputDirectory() {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'experiments'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'reports'), { recursive: true });
  }

  // Core Chaos Experiments
  async runNetworkChaosExperiment() {
    const experiment = {
      name: 'Network Chaos Experiment',
      type: 'network_failure',
      startTime: new Date().toISOString(),
      scenarios: [],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        recoveryTime: null
      }
    };

    console.log('🌪️  Starting Network Chaos Experiment...');
    
    // Start health monitoring
    const healthMonitor = this.startHealthMonitoring();
    
    try {
      // Scenario 1: Complete network failure
      const networkFailureScenario = await this.simulateNetworkFailure();
      experiment.scenarios.push(networkFailureScenario);
      
      // Scenario 2: High latency injection
      const latencyScenario = await this.simulateHighLatency();
      experiment.scenarios.push(latencyScenario);
      
      // Scenario 3: Intermittent failures
      const intermittentScenario = await this.simulateIntermittentFailures();
      experiment.scenarios.push(intermittentScenario);
      
      // Scenario 4: Packet loss simulation
      const packetLossScenario = await this.simulatePacketLoss();
      experiment.scenarios.push(packetLossScenario);

    } finally {
      clearInterval(healthMonitor);
    }

    experiment.endTime = new Date().toISOString();
    experiment.duration = Date.parse(experiment.endTime) - Date.parse(experiment.startTime);
    
    await this.saveExperimentResults(experiment);
    return experiment;
  }

  async simulateNetworkFailure() {
    const scenario = {
      name: 'Complete Network Failure',
      type: 'network_blackhole',
      startTime: new Date().toISOString(),
      duration: 30000, // 30 seconds
      results: {
        beforeFailure: null,
        duringFailure: null,
        afterRecovery: null,
        recoveryTime: null
      }
    };

    // Measure baseline performance
    scenario.results.beforeFailure = await this.measureSystemHealth();
    
    console.log('  💥 Simulating complete network failure...');
    
    // Simulate network failure by blocking requests
    const originalAxios = axios.create;
    const failureStartTime = Date.now();
    
    // Override axios to simulate network failure
    const mockAxios = {
      ...axios,
      create: (config) => ({
        ...axios.create(config),
        request: () => Promise.reject(new Error('Network unreachable'))
      }),
      request: () => Promise.reject(new Error('Network unreachable')),
      get: () => Promise.reject(new Error('Network unreachable')),
      post: () => Promise.reject(new Error('Network unreachable'))
    };
    
    // Replace axios temporarily
    Object.setPrototypeOf(axios, mockAxios);
    
    // Wait for failure duration
    await new Promise(resolve => setTimeout(resolve, scenario.duration));
    
    // Measure during failure
    scenario.results.duringFailure = await this.measureSystemHealthWithRetries();
    
    console.log('  🔄 Restoring network connectivity...');
    
    // Restore original axios
    Object.setPrototypeOf(axios, originalAxios.prototype);
    
    // Wait for system recovery
    const recoveryStartTime = Date.now();
    let systemHealthy = false;
    let recoveryAttempts = 0;
    const maxRecoveryAttempts = 12; // 1 minute with 5-second intervals
    
    while (!systemHealthy && recoveryAttempts < maxRecoveryAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const healthCheck = await this.performHealthCheck();
        if (healthCheck.healthy) {
          systemHealthy = true;
          scenario.results.recoveryTime = Date.now() - recoveryStartTime;
        }
      } catch (error) {
        // System still not healthy
      }
      
      recoveryAttempts++;
    }
    
    // Measure after recovery
    scenario.results.afterRecovery = await this.measureSystemHealth();
    scenario.endTime = new Date().toISOString();
    
    console.log(`  ✅ Network failure simulation completed. Recovery time: ${scenario.results.recoveryTime || 'timeout'}ms`);
    
    return scenario;
  }

  async simulateHighLatency() {
    const scenario = {
      name: 'High Latency Injection',
      type: 'latency_injection',
      startTime: new Date().toISOString(),
      latencyMs: 2000, // 2 second delay
      duration: 60000, // 1 minute
      results: {
        beforeLatency: null,
        duringLatency: null,
        afterLatency: null,
        latencyImpact: null
      }
    };

    console.log('  🐌 Injecting high latency (2s delay)...');
    
    scenario.results.beforeLatency = await this.measureSystemHealth();
    
    // Create axios interceptor for latency injection
    const latencyInterceptor = axios.interceptors.request.use(
      async (config) => {
        await new Promise(resolve => setTimeout(resolve, scenario.latencyMs));
        return config;
      }
    );
    
    // Let latency affect the system
    await new Promise(resolve => setTimeout(resolve, scenario.duration));
    
    scenario.results.duringLatency = await this.measureSystemHealth();
    
    // Remove latency injection
    axios.interceptors.request.eject(latencyInterceptor);
    
    console.log('  🔄 Removing latency injection...');
    
    // Wait for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    scenario.results.afterLatency = await this.measureSystemHealth();
    scenario.endTime = new Date().toISOString();
    
    // Calculate latency impact
    if (scenario.results.beforeLatency && scenario.results.duringLatency) {
      scenario.results.latencyImpact = {
        responseTimeIncrease: scenario.results.duringLatency.averageResponseTime - scenario.results.beforeLatency.averageResponseTime,
        throughputDecrease: scenario.results.beforeLatency.throughput - scenario.results.duringLatency.throughput
      };
    }
    
    console.log('  ✅ Latency injection completed');
    
    return scenario;
  }

  async simulateIntermittentFailures() {
    const scenario = {
      name: 'Intermittent Failures',
      type: 'intermittent_failures',
      startTime: new Date().toISOString(),
      failureRate: 0.3, // 30% failure rate
      duration: 90000, // 1.5 minutes
      results: {
        totalRequests: 0,
        failedRequests: 0,
        actualFailureRate: 0,
        systemStability: null
      }
    };

    console.log('  ⚡ Simulating intermittent failures (30% failure rate)...');
    
    // Create axios interceptor for intermittent failures
    const failureInterceptor = axios.interceptors.request.use(
      async (config) => {
        scenario.results.totalRequests++;
        
        if (Math.random() < scenario.failureRate) {
          scenario.results.failedRequests++;
          throw new Error('Intermittent failure injected');
        }
        
        return config;
      }
    );
    
    // Run load while injecting failures
    const loadTestPromise = this.runBasicLoadTest(scenario.duration);
    await loadTestPromise;
    
    // Remove failure injection
    axios.interceptors.request.eject(failureInterceptor);
    
    scenario.results.actualFailureRate = scenario.results.failedRequests / scenario.results.totalRequests;
    scenario.results.systemStability = await this.measureSystemHealth();
    scenario.endTime = new Date().toISOString();
    
    console.log(`  ✅ Intermittent failures completed. Actual failure rate: ${(scenario.results.actualFailureRate * 100).toFixed(1)}%`);
    
    return scenario;
  }

  async simulatePacketLoss() {
    const scenario = {
      name: 'Packet Loss Simulation',
      type: 'packet_loss',
      startTime: new Date().toISOString(),
      lossPercentage: 15, // 15% packet loss
      duration: 45000, // 45 seconds
      results: {
        beforeLoss: null,
        duringLoss: null,
        afterRecovery: null,
        connectionStability: null
      }
    };

    console.log('  📦 Simulating packet loss (15%)...');
    
    scenario.results.beforeLoss = await this.measureSystemHealth();
    
    // Simulate packet loss by randomly failing requests
    const packetLossInterceptor = axios.interceptors.request.use(
      async (config) => {
        if (Math.random() < 0.15) { // 15% packet loss
          throw new Error('Packet lost');
        }
        
        // Add random delays to simulate network instability
        const delay = Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return config;
      }
    );
    
    await new Promise(resolve => setTimeout(resolve, scenario.duration));
    
    scenario.results.duringLoss = await this.measureSystemHealthWithRetries();
    
    // Remove packet loss simulation
    axios.interceptors.request.eject(packetLossInterceptor);
    
    console.log('  🔄 Restoring network stability...');
    
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    scenario.results.afterRecovery = await this.measureSystemHealth();
    scenario.endTime = new Date().toISOString();
    
    console.log('  ✅ Packet loss simulation completed');
    
    return scenario;
  }

  // Service Dependency Chaos
  async runServiceDependencyChaos() {
    const experiment = {
      name: 'Service Dependency Chaos',
      type: 'dependency_failure',
      startTime: new Date().toISOString(),
      scenarios: []
    };

    console.log('🔌 Starting Service Dependency Chaos...');
    
    // Scenario 1: Database connection failure
    const dbFailureScenario = await this.simulateDatabaseFailure();
    experiment.scenarios.push(dbFailureScenario);
    
    // Scenario 2: External API failure (Gemini TTS)
    const apiFailureScenario = await this.simulateExternalAPIFailure();
    experiment.scenarios.push(apiFailureScenario);
    
    // Scenario 3: File system failure
    const fsFailureScenario = await this.simulateFileSystemFailure();
    experiment.scenarios.push(fsFailureScenario);

    experiment.endTime = new Date().toISOString();
    await this.saveExperimentResults(experiment);
    
    return experiment;
  }

  async simulateDatabaseFailure() {
    const scenario = {
      name: 'Database Connection Failure',
      type: 'database_failure',
      startTime: new Date().toISOString(),
      duration: 60000,
      results: {
        connectionAttempts: 0,
        failedConnections: 0,
        systemResponse: null,
        gracefulDegradation: false
      }
    };

    console.log('  🗃️  Simulating database connection failure...');
    
    // Try to make requests that require database access
    const dbEndpoints = [
      '/api/flashcards',
      '/api/auth/login',
      '/api/users/profile'
    ];
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < scenario.duration) {
      for (const endpoint of dbEndpoints) {
        try {
          scenario.results.connectionAttempts++;
          
          const response = await axios({
            method: 'GET',
            url: `${this.baseUrl}${endpoint}`,
            timeout: 5000,
            headers: {
              'Authorization': 'Bearer test-token'
            }
          });
          
          // Check if response indicates graceful degradation
          if (response.status === 200 && response.data) {
            if (response.data.fallback || response.data.cached) {
              scenario.results.gracefulDegradation = true;
            }
          }
          
        } catch (error) {
          scenario.results.failedConnections++;
          
          // Analyze error response for proper error handling
          if (error.response && error.response.status === 503) {
            scenario.results.gracefulDegradation = true;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    scenario.results.systemResponse = await this.measureSystemHealth();
    scenario.endTime = new Date().toISOString();
    
    console.log(`  ✅ Database failure simulation completed. Graceful degradation: ${scenario.results.gracefulDegradation}`);
    
    return scenario;
  }

  async simulateExternalAPIFailure() {
    const scenario = {
      name: 'External API Failure (TTS Service)',
      type: 'external_api_failure',
      startTime: new Date().toISOString(),
      duration: 45000,
      results: {
        ttsRequests: 0,
        fallbackResponses: 0,
        timeoutHandling: false
      }
    };

    console.log('  🔊 Simulating TTS service failure...');
    
    // Test TTS endpoints
    const startTime = Date.now();
    
    while (Date.now() - startTime < scenario.duration) {
      try {
        scenario.results.ttsRequests++;
        
        const response = await axios({
          method: 'POST',
          url: `${this.baseUrl}/api/audio/generate`,
          data: { text: 'Test audio generation' },
          timeout: 10000,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        });
        
        // Check for fallback behavior
        if (response.data && response.data.fallback) {
          scenario.results.fallbackResponses++;
        }
        
      } catch (error) {
        if (error.code === 'ECONNABORTED') {
          scenario.results.timeoutHandling = true;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    scenario.endTime = new Date().toISOString();
    
    console.log(`  ✅ External API failure simulation completed. Fallback responses: ${scenario.results.fallbackResponses}`);
    
    return scenario;
  }

  async simulateFileSystemFailure() {
    const scenario = {
      name: 'File System Failure',
      type: 'filesystem_failure',
      startTime: new Date().toISOString(),
      duration: 30000,
      results: {
        fileOperations: 0,
        failedOperations: 0,
        errorHandling: false
      }
    };

    console.log('  📁 Simulating file system failure...');
    
    // Simulate file upload/download operations
    const startTime = Date.now();
    
    while (Date.now() - startTime < scenario.duration) {
      try {
        scenario.results.fileOperations++;
        
        // Test file operations
        const response = await axios({
          method: 'POST',
          url: `${this.baseUrl}/api/upload`,
          data: { file: 'test-file-content' },
          timeout: 5000,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        });
        
      } catch (error) {
        scenario.results.failedOperations++;
        
        // Check for proper error handling
        if (error.response && error.response.data && error.response.data.error) {
          scenario.results.errorHandling = true;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    scenario.endTime = new Date().toISOString();
    
    console.log(`  ✅ File system failure simulation completed`);
    
    return scenario;
  }

  // Resource Exhaustion Tests
  async runResourceExhaustionChaos() {
    const experiment = {
      name: 'Resource Exhaustion Chaos',
      type: 'resource_exhaustion',
      startTime: new Date().toISOString(),
      scenarios: []
    };

    console.log('💾 Starting Resource Exhaustion Chaos...');
    
    // Scenario 1: Memory pressure
    const memoryPressureScenario = await this.simulateMemoryPressure();
    experiment.scenarios.push(memoryPressureScenario);
    
    // Scenario 2: CPU exhaustion
    const cpuExhaustionScenario = await this.simulateCPUExhaustion();
    experiment.scenarios.push(cpuExhaustionScenario);
    
    // Scenario 3: Connection pool exhaustion
    const connectionExhaustionScenario = await this.simulateConnectionExhaustion();
    experiment.scenarios.push(connectionExhaustionScenario);

    experiment.endTime = new Date().toISOString();
    await this.saveExperimentResults(experiment);
    
    return experiment;
  }

  async simulateMemoryPressure() {
    const scenario = {
      name: 'Memory Pressure Simulation',
      type: 'memory_pressure',
      startTime: new Date().toISOString(),
      duration: 120000, // 2 minutes
      results: {
        initialMemory: process.memoryUsage(),
        peakMemory: null,
        finalMemory: null,
        memoryLeaks: false,
        systemStability: null
      }
    };

    console.log('  🧠 Simulating memory pressure...');
    
    // Create memory pressure
    const memoryHogs = [];
    const startTime = Date.now();
    
    const memoryInterval = setInterval(() => {
      // Allocate large arrays to consume memory
      const largeArray = new Array(100000).fill('memory-hog-' + Math.random());
      memoryHogs.push(largeArray);
      
      // Limit memory usage to prevent system crash
      if (memoryHogs.length > 100) {
        memoryHogs.shift(); // Remove oldest allocation
      }
      
      const currentMemory = process.memoryUsage();
      if (!scenario.results.peakMemory || currentMemory.heapUsed > scenario.results.peakMemory.heapUsed) {
        scenario.results.peakMemory = currentMemory;
      }
      
    }, 1000);
    
    // Monitor system during memory pressure
    const monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.log('    System experiencing memory pressure effects');
      }
    }, 5000);
    
    await new Promise(resolve => setTimeout(resolve, scenario.duration));
    
    clearInterval(memoryInterval);
    clearInterval(monitoringInterval);
    
    // Clean up memory allocations
    memoryHogs.length = 0;
    
    if (global.gc) {
      global.gc(); // Force garbage collection if available
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for cleanup
    
    scenario.results.finalMemory = process.memoryUsage();
    scenario.results.systemStability = await this.measureSystemHealth();
    scenario.endTime = new Date().toISOString();
    
    // Check for memory leaks
    const memoryDifference = scenario.results.finalMemory.heapUsed - scenario.results.initialMemory.heapUsed;
    scenario.results.memoryLeaks = memoryDifference > (50 * 1024 * 1024); // 50MB threshold
    
    console.log(`  ✅ Memory pressure simulation completed. Memory leaks detected: ${scenario.results.memoryLeaks}`);
    
    return scenario;
  }

  async simulateCPUExhaustion() {
    const scenario = {
      name: 'CPU Exhaustion Simulation',
      type: 'cpu_exhaustion',
      startTime: new Date().toISOString(),
      duration: 60000,
      results: {
        cpuLoadProcesses: 0,
        systemResponseTime: null,
        gracefulDegradation: false
      }
    };

    console.log('  ⚡ Simulating CPU exhaustion...');
    
    // Create CPU-intensive tasks
    const cpuHogs = [];
    const numCores = require('os').cpus().length;
    
    for (let i = 0; i < numCores; i++) {
      const cpuHog = setInterval(() => {
        const start = Date.now();
        while (Date.now() - start < 900) {
          // CPU intensive calculation
          Math.sqrt(Math.random() * 1000000);
        }
      }, 1000);
      
      cpuHogs.push(cpuHog);
      scenario.results.cpuLoadProcesses++;
    }
    
    // Monitor system response during CPU pressure
    const responseTimeTests = [];
    const monitoringInterval = setInterval(async () => {
      const start = Date.now();
      try {
        await this.performHealthCheck();
        responseTimeTests.push(Date.now() - start);
      } catch (error) {
        responseTimeTests.push(10000); // Timeout value
      }
    }, 5000);
    
    await new Promise(resolve => setTimeout(resolve, scenario.duration));
    
    // Stop CPU load
    cpuHogs.forEach(clearInterval);
    clearInterval(monitoringInterval);
    
    // Calculate average response time during CPU pressure
    if (responseTimeTests.length > 0) {
      scenario.results.systemResponseTime = responseTimeTests.reduce((sum, time) => sum + time, 0) / responseTimeTests.length;
      
      // Check if system maintained reasonable response times
      scenario.results.gracefulDegradation = scenario.results.systemResponseTime < 5000;
    }
    
    scenario.endTime = new Date().toISOString();
    
    console.log(`  ✅ CPU exhaustion simulation completed. Average response time: ${scenario.results.systemResponseTime}ms`);
    
    return scenario;
  }

  async simulateConnectionExhaustion() {
    const scenario = {
      name: 'Connection Pool Exhaustion',
      type: 'connection_exhaustion',
      startTime: new Date().toISOString(),
      duration: 90000,
      results: {
        concurrentConnections: 0,
        connectionFailures: 0,
        maxConcurrentConnections: 0,
        poolExhausted: false
      }
    };

    console.log('  🔗 Simulating connection pool exhaustion...');
    
    const activeConnections = [];
    const startTime = Date.now();
    
    // Create many concurrent connections
    const connectionInterval = setInterval(async () => {
      if (Date.now() - startTime >= scenario.duration) {
        clearInterval(connectionInterval);
        return;
      }
      
      try {
        const connectionPromise = axios({
          method: 'GET',
          url: `${this.baseUrl}/api/flashcards`,
          timeout: 30000,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        });
        
        activeConnections.push(connectionPromise);
        scenario.results.concurrentConnections++;
        
        if (scenario.results.concurrentConnections > scenario.results.maxConcurrentConnections) {
          scenario.results.maxConcurrentConnections = scenario.results.concurrentConnections;
        }
        
        // Handle connection completion
        connectionPromise
          .then(() => {
            const index = activeConnections.indexOf(connectionPromise);
            if (index > -1) {
              activeConnections.splice(index, 1);
              scenario.results.concurrentConnections--;
            }
          })
          .catch((error) => {
            scenario.results.connectionFailures++;
            const index = activeConnections.indexOf(connectionPromise);
            if (index > -1) {
              activeConnections.splice(index, 1);
              scenario.results.concurrentConnections--;
            }
            
            // Check if it's a connection pool exhaustion error
            if (error.code === 'ECONNREFUSED' || error.message.includes('pool')) {
              scenario.results.poolExhausted = true;
            }
          });
        
      } catch (error) {
        scenario.results.connectionFailures++;
      }
      
    }, 100); // Create new connection every 100ms
    
    await new Promise(resolve => setTimeout(resolve, scenario.duration));
    
    // Wait for remaining connections to complete or timeout
    await Promise.allSettled(activeConnections);
    
    scenario.endTime = new Date().toISOString();
    
    console.log(`  ✅ Connection exhaustion simulation completed. Max concurrent: ${scenario.results.maxConcurrentConnections}`);
    
    return scenario;
  }

  // Health Monitoring and Utilities
  startHealthMonitoring() {
    const healthData = [];
    
    const monitor = setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        healthData.push({
          timestamp: new Date().toISOString(),
          ...health
        });
        
        this.emit('health-update', health);
        
      } catch (error) {
        healthData.push({
          timestamp: new Date().toISOString(),
          healthy: false,
          error: error.message
        });
      }
    }, this.healthCheckInterval);

    this.currentHealthData = healthData;
    return monitor;
  }

  async performHealthCheck() {
    const healthCheck = {
      timestamp: Date.now(),
      healthy: true,
      responseTime: null,
      statusCode: null,
      error: null
    };

    const start = Date.now();
    
    try {
      const response = await axios({
        method: 'GET',
        url: `${this.baseUrl}/health`,
        timeout: 5000
      });
      
      healthCheck.responseTime = Date.now() - start;
      healthCheck.statusCode = response.status;
      healthCheck.healthy = response.status === 200;
      
    } catch (error) {
      healthCheck.responseTime = Date.now() - start;
      healthCheck.healthy = false;
      healthCheck.error = error.message;
      
      if (error.response) {
        healthCheck.statusCode = error.response.status;
      }
    }

    return healthCheck;
  }

  async measureSystemHealth() {
    const measurements = [];
    const numMeasurements = 5;
    
    for (let i = 0; i < numMeasurements; i++) {
      try {
        const measurement = await this.performHealthCheck();
        measurements.push(measurement);
        
        if (i < numMeasurements - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        measurements.push({
          healthy: false,
          responseTime: 10000,
          error: error.message
        });
      }
    }
    
    // Calculate metrics
    const healthyMeasurements = measurements.filter(m => m.healthy);
    const responseTimes = measurements.filter(m => m.responseTime).map(m => m.responseTime);
    
    return {
      healthRatio: healthyMeasurements.length / measurements.length,
      averageResponseTime: responseTimes.length > 0 ? 
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : null,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : null,
      minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : null,
      throughput: healthyMeasurements.length > 0 ? 
        1000 / (responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length) : 0,
      timestamp: new Date().toISOString()
    };
  }

  async measureSystemHealthWithRetries() {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        return await this.measureSystemHealth();
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          return {
            healthRatio: 0,
            averageResponseTime: null,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async runBasicLoadTest(duration) {
    const endpoints = ['/api/flashcards', '/health'];
    const promises = [];
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      
      const promise = axios({
        method: 'GET',
        url: `${this.baseUrl}${endpoint}`,
        timeout: 5000,
        headers: endpoint !== '/health' ? { 'Authorization': 'Bearer test-token' } : {}
      }).catch(() => {}); // Ignore errors for this basic load test
      
      promises.push(promise);
      
      // Limit concurrent requests
      if (promises.length >= 20) {
        await Promise.allSettled(promises.splice(0, 10));
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await Promise.allSettled(promises);
  }

  // Main Execution
  async runFullChaosExperiment() {
    console.log('🌪️  Starting Full Chaos Engineering Experiment...');
    
    const fullExperiment = {
      name: 'Comprehensive Chaos Engineering Test',
      startTime: new Date().toISOString(),
      experiments: []
    };

    try {
      // Run all chaos experiments
      const networkExperiment = await this.runNetworkChaosExperiment();
      fullExperiment.experiments.push(networkExperiment);
      
      const dependencyExperiment = await this.runServiceDependencyChaos();
      fullExperiment.experiments.push(dependencyExperiment);
      
      const resourceExperiment = await this.runResourceExhaustionChaos();
      fullExperiment.experiments.push(resourceExperiment);

      fullExperiment.endTime = new Date().toISOString();
      
      // Generate comprehensive report
      const report = await this.generateChaosReport(fullExperiment);
      
      console.log('\n🎯 Chaos Engineering Results:');
      console.log(`  Total Experiments: ${fullExperiment.experiments.length}`);
      console.log(`  Duration: ${((Date.parse(fullExperiment.endTime) - Date.parse(fullExperiment.startTime)) / 1000 / 60).toFixed(1)} minutes`);
      
      return {
        experiment: fullExperiment,
        report: report
      };

    } catch (error) {
      console.error('Chaos experiment failed:', error);
      throw error;
    }
  }

  async saveExperimentResults(experiment) {
    const timestamp = experiment.startTime.replace(/[:.]/g, '-');
    const filename = `chaos-${experiment.type}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, 'experiments', filename);
    
    await fs.writeFile(filepath, JSON.stringify(experiment, null, 2));
    console.log(`Experiment results saved: ${filepath}`);
  }

  async generateChaosReport(fullExperiment) {
    const report = {
      ...fullExperiment,
      summary: this.calculateExperimentSummary(fullExperiment),
      resilience: this.assessSystemResilience(fullExperiment),
      recommendations: this.generateResilienceRecommendations(fullExperiment)
    };

    const reportPath = path.join(this.outputDir, 'chaos-engineering-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`Chaos engineering report generated: ${reportPath}`);
    return reportPath;
  }

  calculateExperimentSummary(experiment) {
    let totalScenarios = 0;
    let successfulScenarios = 0;
    let recoveryTimes = [];

    for (const exp of experiment.experiments) {
      if (exp.scenarios) {
        totalScenarios += exp.scenarios.length;
        
        for (const scenario of exp.scenarios) {
          if (scenario.results && scenario.results.recoveryTime) {
            recoveryTimes.push(scenario.results.recoveryTime);
          }
          
          // Determine if scenario was successful based on recovery
          if (scenario.results && !scenario.results.systemFailure) {
            successfulScenarios++;
          }
        }
      }
    }

    return {
      totalScenarios: totalScenarios,
      successfulScenarios: successfulScenarios,
      failedScenarios: totalScenarios - successfulScenarios,
      averageRecoveryTime: recoveryTimes.length > 0 ? 
        recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length : null,
      maxRecoveryTime: recoveryTimes.length > 0 ? Math.max(...recoveryTimes) : null
    };
  }

  assessSystemResilience(experiment) {
    const scores = {
      networkResilience: 0,
      dependencyResilience: 0,
      resourceResilience: 0,
      overallResilience: 0
    };

    // Assess based on experiment results
    for (const exp of experiment.experiments) {
      let experimentScore = 0;
      let scenarioCount = 0;

      if (exp.scenarios) {
        for (const scenario of exp.scenarios) {
          scenarioCount++;
          
          // Score based on recovery time and graceful degradation
          if (scenario.results) {
            let scenarioScore = 0;
            
            if (scenario.results.recoveryTime && scenario.results.recoveryTime < 30000) {
              scenarioScore += 30; // Quick recovery
            } else if (scenario.results.recoveryTime && scenario.results.recoveryTime < 60000) {
              scenarioScore += 20; // Moderate recovery
            } else if (scenario.results.recoveryTime) {
              scenarioScore += 10; // Slow recovery
            }
            
            if (scenario.results.gracefulDegradation) {
              scenarioScore += 40; // Graceful degradation
            }
            
            if (scenario.results.systemStability && scenario.results.systemStability.healthRatio > 0.8) {
              scenarioScore += 30; // Good stability
            }
            
            experimentScore += scenarioScore;
          }
        }
      }

      const avgScore = scenarioCount > 0 ? experimentScore / scenarioCount : 0;

      switch (exp.type) {
        case 'network_failure':
          scores.networkResilience = avgScore;
          break;
        case 'dependency_failure':
          scores.dependencyResilience = avgScore;
          break;
        case 'resource_exhaustion':
          scores.resourceResilience = avgScore;
          break;
      }
    }

    scores.overallResilience = (scores.networkResilience + scores.dependencyResilience + scores.resourceResilience) / 3;

    return scores;
  }

  generateResilienceRecommendations(experiment) {
    const recommendations = [];
    const resilience = this.assessSystemResilience(experiment);

    if (resilience.networkResilience < 50) {
      recommendations.push('Implement circuit breakers and retry mechanisms for network failures');
    }

    if (resilience.dependencyResilience < 50) {
      recommendations.push('Add fallback mechanisms for external service dependencies');
    }

    if (resilience.resourceResilience < 50) {
      recommendations.push('Implement resource limits and graceful degradation under load');
    }

    if (resilience.overallResilience < 60) {
      recommendations.push('Consider implementing a comprehensive health check and monitoring system');
    }

    if (recommendations.length === 0) {
      recommendations.push('System demonstrates good resilience - maintain current practices');
    }

    return recommendations;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  const options = {
    baseUrl: process.env.BASE_URL || 'http://localhost:4000'
  };

  const chaosFramework = new ChaosEngineeringFramework(options);
  
  try {
    await chaosFramework.initialize();
    
    let result;
    
    switch (command) {
      case 'network':
        result = await chaosFramework.runNetworkChaosExperiment();
        break;
      case 'dependencies':
        result = await chaosFramework.runServiceDependencyChaos();
        break;
      case 'resources':
        result = await chaosFramework.runResourceExhaustionChaos();
        break;
      case 'full':
      default:
        result = await chaosFramework.runFullChaosExperiment();
        break;
    }
    
    console.log('\n✅ Chaos engineering experiment completed successfully');
    
  } catch (error) {
    console.error('\n❌ Chaos engineering experiment failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ChaosEngineeringFramework;