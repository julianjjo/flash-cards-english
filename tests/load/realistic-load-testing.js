#!/usr/bin/env node

/**
 * Realistic Load Testing Framework - Advanced user behavior simulation
 * 
 * Features:
 * - Realistic user journey simulation
 * - Dynamic load patterns (ramp-up, steady-state, peak traffic)
 * - User behavior modeling (think time, session duration)
 * - Geographic distribution simulation
 * - Device and browser simulation
 * - Session persistence and cookies
 * - Performance metrics collection
 * - Real-time monitoring and alerting
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { performance } = require('perf_hooks');
const EventEmitter = require('events');

class RealisticLoadTester extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.baseUrl = options.baseUrl || 'http://localhost:4000';
    this.outputDir = options.outputDir || path.join(process.cwd(), 'load-test-results');
    
    // Load testing configuration
    this.config = {
      maxVirtualUsers: options.maxVirtualUsers || 100,
      testDuration: options.testDuration || 300000, // 5 minutes
      rampUpTime: options.rampUpTime || 60000, // 1 minute
      rampDownTime: options.rampDownTime || 60000, // 1 minute
      thinkTimeMin: options.thinkTimeMin || 1000, // 1 second
      thinkTimeMax: options.thinkTimeMax || 5000, // 5 seconds
      sessionDuration: options.sessionDuration || 180000, // 3 minutes
    };

    // User behavior patterns
    this.userProfiles = [
      {
        name: 'casual_learner',
        weight: 0.6, // 60% of users
        sessionDuration: 120000, // 2 minutes
        actionsPerSession: 8,
        studyFocused: false,
        errorRate: 0.1
      },
      {
        name: 'dedicated_student',
        weight: 0.3, // 30% of users
        sessionDuration: 300000, // 5 minutes
        actionsPerSession: 20,
        studyFocused: true,
        errorRate: 0.05
      },
      {
        name: 'power_user',
        weight: 0.1, // 10% of users
        sessionDuration: 600000, // 10 minutes
        actionsPerSession: 50,
        studyFocused: true,
        errorRate: 0.02
      }
    ];

    // Device and browser simulation
    this.deviceProfiles = [
      {
        name: 'desktop_chrome',
        weight: 0.45,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        connectionSpeed: 'fast'
      },
      {
        name: 'mobile_safari',
        weight: 0.35,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
        viewport: { width: 375, height: 667 },
        connectionSpeed: 'medium'
      },
      {
        name: 'desktop_firefox',
        weight: 0.15,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        viewport: { width: 1366, height: 768 },
        connectionSpeed: 'fast'
      },
      {
        name: 'tablet_android',
        weight: 0.05,
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-T510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36',
        viewport: { width: 768, height: 1024 },
        connectionSpeed: 'medium'
      }
    ];

    // Geographic simulation
    this.geoLocations = [
      { name: 'North America', weight: 0.4, latency: 50 },
      { name: 'Europe', weight: 0.3, latency: 100 },
      { name: 'Asia', weight: 0.2, latency: 150 },
      { name: 'South America', weight: 0.06, latency: 200 },
      { name: 'Africa', weight: 0.03, latency: 250 },
      { name: 'Oceania', weight: 0.01, latency: 180 }
    ];

    // Metrics collection
    this.metrics = {
      virtualUsers: 0,
      activeUsers: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errorTypes: new Map(),
      userJourneys: [],
      throughput: 0,
      concurrentSessions: 0
    };

    this.activeUsers = new Set();
    this.completedJourneys = [];
  }

  async initialize() {
    await this.ensureOutputDirectory();
    console.log('Realistic Load Testing framework initialized');
  }

  async ensureOutputDirectory() {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'reports'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'metrics'), { recursive: true });
  }

  // User Profile Selection
  selectUserProfile() {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const profile of this.userProfiles) {
      cumulativeWeight += profile.weight;
      if (random <= cumulativeWeight) {
        return { ...profile };
      }
    }
    
    return { ...this.userProfiles[0] };
  }

  selectDeviceProfile() {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const device of this.deviceProfiles) {
      cumulativeWeight += device.weight;
      if (random <= cumulativeWeight) {
        return { ...device };
      }
    }
    
    return { ...this.deviceProfiles[0] };
  }

  selectGeoLocation() {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const location of this.geoLocations) {
      cumulativeWeight += location.weight;
      if (random <= cumulativeWeight) {
        return { ...location };
      }
    }
    
    return { ...this.geoLocations[0] };
  }

  // Virtual User Session Simulation
  async createVirtualUser(userId) {
    const userProfile = this.selectUserProfile();
    const deviceProfile = this.selectDeviceProfile();
    const geoLocation = this.selectGeoLocation();
    
    const virtualUser = {
      id: userId,
      profile: userProfile,
      device: deviceProfile,
      location: geoLocation,
      session: {
        startTime: Date.now(),
        endTime: null,
        authToken: null,
        cookies: new Map(),
        actions: [],
        currentPage: 'landing'
      },
      stats: {
        requestCount: 0,
        errorCount: 0,
        avgResponseTime: 0,
        totalThinkTime: 0
      }
    };

    this.activeUsers.add(virtualUser);
    this.metrics.virtualUsers++;
    this.metrics.activeUsers++;

    try {
      await this.simulateUserJourney(virtualUser);
    } catch (error) {
      console.error(`User ${userId} journey failed:`, error.message);
    } finally {
      this.activeUsers.delete(virtualUser);
      this.metrics.activeUsers--;
      
      virtualUser.session.endTime = Date.now();
      virtualUser.session.duration = virtualUser.session.endTime - virtualUser.session.startTime;
      
      this.completedJourneys.push(virtualUser);
    }
  }

  async simulateUserJourney(user) {
    const journey = {
      userId: user.id,
      profile: user.profile.name,
      startTime: Date.now(),
      actions: []
    };

    // Simulate realistic user behavior patterns
    switch (user.profile.name) {
      case 'casual_learner':
        await this.simulateCasualLearnerJourney(user, journey);
        break;
      case 'dedicated_student':
        await this.simulateDedicatedStudentJourney(user, journey);
        break;
      case 'power_user':
        await this.simulatePowerUserJourney(user, journey);
        break;
    }

    journey.endTime = Date.now();
    journey.duration = journey.endTime - journey.startTime;
    
    this.metrics.userJourneys.push(journey);
  }

  async simulateCasualLearnerJourney(user, journey) {
    // Casual learner: Quick study session, might not complete
    
    // 1. Landing page visit
    await this.simulatePageVisit(user, '/', 'landing', journey);
    
    // 2. Quick browse, might leave early (30% bounce rate)
    if (Math.random() < 0.3) {
      return; // Bounce
    }
    
    // 3. Login (80% login, 20% continue as guest)
    if (Math.random() < 0.8) {
      await this.simulateLogin(user, journey);
    }
    
    // 4. Brief study session (3-8 flashcards)
    const studyCount = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < studyCount; i++) {
      await this.simulateFlashcardStudy(user, journey);
      
      // Might get distracted and leave (10% chance per card)
      if (Math.random() < 0.1) {
        break;
      }
    }
    
    // 5. Quick logout or session abandonment
    if (user.session.authToken && Math.random() < 0.6) {
      await this.simulateLogout(user, journey);
    }
  }

  async simulateDedicatedStudentJourney(user, journey) {
    // Dedicated student: Focused study session with goal completion
    
    // 1. Direct login (95% login immediately)
    await this.simulatePageVisit(user, '/', 'landing', journey);
    
    if (Math.random() < 0.95) {
      await this.simulateLogin(user, journey);
    }
    
    // 2. Check progress/stats
    await this.simulatePageVisit(user, '/profile', 'profile', journey);
    
    // 3. Intensive study session (15-25 flashcards)
    const studyCount = 15 + Math.floor(Math.random() * 11);
    for (let i = 0; i < studyCount; i++) {
      await this.simulateFlashcardStudy(user, journey);
      
      // Occasional break (5% chance)
      if (Math.random() < 0.05) {
        await this.simulateThinkTime(user, 3000, 8000); // Longer break
      }
    }
    
    // 4. Review session statistics
    await this.simulatePageVisit(user, '/stats', 'statistics', journey);
    
    // 5. Proper logout (90% chance)
    if (user.session.authToken && Math.random() < 0.9) {
      await this.simulateLogout(user, journey);
    }
  }

  async simulatePowerUserJourney(user, journey) {
    // Power user: Comprehensive usage, admin features, long session
    
    // 1. Direct login
    await this.simulatePageVisit(user, '/', 'landing', journey);
    await this.simulateLogin(user, journey, true); // Admin login
    
    // 2. Dashboard review
    await this.simulatePageVisit(user, '/admin', 'admin_dashboard', journey);
    
    // 3. User management (if admin)
    if (Math.random() < 0.7) {
      await this.simulateAdminActions(user, journey);
    }
    
    // 4. Extensive study session (30-50+ flashcards)
    const studyCount = 30 + Math.floor(Math.random() * 21);
    for (let i = 0; i < studyCount; i++) {
      await this.simulateFlashcardStudy(user, journey);
    }
    
    // 5. Create new content
    if (Math.random() < 0.8) {
      await this.simulateContentCreation(user, journey);
    }
    
    // 6. System settings review
    await this.simulatePageVisit(user, '/settings', 'settings', journey);
    
    // 7. Proper logout
    await this.simulateLogout(user, journey);
  }

  // Action Simulation Methods
  async simulatePageVisit(user, path, pageName, journey) {
    const actionStart = performance.now();
    
    try {
      const response = await this.makeUserRequest(user, 'GET', path);
      
      const action = {
        type: 'page_visit',
        page: pageName,
        path: path,
        timestamp: Date.now(),
        responseTime: performance.now() - actionStart,
        statusCode: response.status,
        success: response.status >= 200 && response.status < 400
      };
      
      journey.actions.push(action);
      user.session.actions.push(action);
      user.session.currentPage = pageName;
      
      // Update metrics
      this.metrics.totalRequests++;
      if (action.success) {
        this.metrics.successfulRequests++;
      } else {
        this.metrics.failedRequests++;
      }
      
      this.metrics.responseTimes.push(action.responseTime);
      
      // Simulate page load time
      await this.simulateThinkTime(user, 500, 2000);
      
    } catch (error) {
      this.handleUserError(user, error, 'page_visit', journey);
    }
  }

  async simulateLogin(user, journey, isAdmin = false) {
    const actionStart = performance.now();
    
    try {
      const credentials = {
        email: isAdmin ? 'admin@test.com' : `user${user.id}@test.com`,
        password: 'TestPassword123!'
      };
      
      const response = await this.makeUserRequest(user, 'POST', '/api/auth/login', credentials);
      
      const action = {
        type: 'login',
        timestamp: Date.now(),
        responseTime: performance.now() - actionStart,
        statusCode: response.status,
        success: response.status === 200 && response.data.token
      };
      
      if (action.success) {
        user.session.authToken = response.data.token;
      }
      
      journey.actions.push(action);
      this.updateMetrics(action);
      
      // Think time after login
      await this.simulateThinkTime(user, 1000, 3000);
      
    } catch (error) {
      this.handleUserError(user, error, 'login', journey);
    }
  }

  async simulateFlashcardStudy(user, journey) {
    const actionStart = performance.now();
    
    try {
      // Get flashcards
      const getCardsResponse = await this.makeUserRequest(user, 'GET', '/api/flashcards');
      
      if (getCardsResponse.status === 200 && getCardsResponse.data.length > 0) {
        const flashcard = getCardsResponse.data[Math.floor(Math.random() * getCardsResponse.data.length)];
        
        // Simulate studying the flashcard
        const studyAction = {
          type: 'flashcard_study',
          flashcardId: flashcard.id,
          timestamp: Date.now(),
          responseTime: performance.now() - actionStart,
          statusCode: getCardsResponse.status,
          success: true
        };
        
        journey.actions.push(studyAction);
        this.updateMetrics(studyAction);
        
        // Simulate thinking about the answer
        await this.simulateThinkTime(user, 2000, 8000);
        
        // Submit answer (simulate TTS request occasionally)
        if (Math.random() < 0.3) {
          await this.simulateTTSRequest(user, flashcard, journey);
        }
        
        // Update flashcard (mark as reviewed)
        await this.simulateFlashcardUpdate(user, flashcard, journey);
      }
      
    } catch (error) {
      this.handleUserError(user, error, 'flashcard_study', journey);
    }
  }

  async simulateTTSRequest(user, flashcard, journey) {
    const actionStart = performance.now();
    
    try {
      const response = await this.makeUserRequest(user, 'POST', '/api/audio/generate', {
        text: flashcard.spanish || flashcard.english
      });
      
      const action = {
        type: 'tts_request',
        flashcardId: flashcard.id,
        timestamp: Date.now(),
        responseTime: performance.now() - actionStart,
        statusCode: response.status,
        success: response.status === 200
      };
      
      journey.actions.push(action);
      this.updateMetrics(action);
      
    } catch (error) {
      this.handleUserError(user, error, 'tts_request', journey);
    }
  }

  async simulateFlashcardUpdate(user, flashcard, journey) {
    const actionStart = performance.now();
    
    try {
      const updateData = {
        difficulty: Math.min(5, flashcard.difficulty + (Math.random() > 0.5 ? 1 : 0)),
        last_reviewed: new Date().toISOString(),
        review_count: (flashcard.review_count || 0) + 1
      };
      
      const response = await this.makeUserRequest(user, 'PUT', `/api/flashcards/${flashcard.id}`, updateData);
      
      const action = {
        type: 'flashcard_update',
        flashcardId: flashcard.id,
        timestamp: Date.now(),
        responseTime: performance.now() - actionStart,
        statusCode: response.status,
        success: response.status === 200
      };
      
      journey.actions.push(action);
      this.updateMetrics(action);
      
    } catch (error) {
      this.handleUserError(user, error, 'flashcard_update', journey);
    }
  }

  async simulateAdminActions(user, journey) {
    const actions = [
      { path: '/api/admin/users', method: 'GET', type: 'admin_view_users' },
      { path: '/api/admin/stats', method: 'GET', type: 'admin_view_stats' },
      { path: '/api/flashcards', method: 'GET', type: 'admin_view_content' }
    ];
    
    const selectedActions = actions.sort(() => 0.5 - Math.random()).slice(0, 2);
    
    for (const actionConfig of selectedActions) {
      const actionStart = performance.now();
      
      try {
        const response = await this.makeUserRequest(user, actionConfig.method, actionConfig.path);
        
        const action = {
          type: actionConfig.type,
          timestamp: Date.now(),
          responseTime: performance.now() - actionStart,
          statusCode: response.status,
          success: response.status === 200
        };
        
        journey.actions.push(action);
        this.updateMetrics(action);
        
        await this.simulateThinkTime(user, 1000, 4000);
        
      } catch (error) {
        this.handleUserError(user, error, actionConfig.type, journey);
      }
    }
  }

  async simulateContentCreation(user, journey) {
    const actionStart = performance.now();
    
    try {
      const newFlashcard = {
        english: `Test English ${Date.now()}`,
        spanish: `Test Español ${Date.now()}`
      };
      
      const response = await this.makeUserRequest(user, 'POST', '/api/flashcards', newFlashcard);
      
      const action = {
        type: 'content_creation',
        timestamp: Date.now(),
        responseTime: performance.now() - actionStart,
        statusCode: response.status,
        success: response.status === 201
      };
      
      journey.actions.push(action);
      this.updateMetrics(action);
      
      // Think time after creating content
      await this.simulateThinkTime(user, 2000, 5000);
      
    } catch (error) {
      this.handleUserError(user, error, 'content_creation', journey);
    }
  }

  async simulateLogout(user, journey) {
    const actionStart = performance.now();
    
    try {
      const response = await this.makeUserRequest(user, 'POST', '/api/auth/logout');
      
      const action = {
        type: 'logout',
        timestamp: Date.now(),
        responseTime: performance.now() - actionStart,
        statusCode: response.status,
        success: response.status === 200
      };
      
      user.session.authToken = null;
      
      journey.actions.push(action);
      this.updateMetrics(action);
      
    } catch (error) {
      this.handleUserError(user, error, 'logout', journey);
    }
  }

  // Network and Request Simulation
  async makeUserRequest(user, method, path, data = null) {
    // Simulate geographic latency
    if (user.location.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, user.location.latency / 2));
    }
    
    // Simulate connection speed delays
    const connectionDelay = this.getConnectionDelay(user.device.connectionSpeed);
    if (connectionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, connectionDelay));
    }
    
    const headers = {
      'User-Agent': user.device.userAgent
    };
    
    if (user.session.authToken) {
      headers['Authorization'] = `Bearer ${user.session.authToken}`;
    }
    
    // Add cookies if any
    if (user.session.cookies.size > 0) {
      headers['Cookie'] = Array.from(user.session.cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }
    
    const config = {
      method: method,
      url: `${this.baseUrl}${path}`,
      headers: headers,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on HTTP errors
      ...data && { data: data }
    };
    
    // Simulate occasional network errors based on user profile
    if (Math.random() < user.profile.errorRate) {
      throw new Error('Simulated network error');
    }
    
    const response = await axios(config);
    
    // Store cookies from response
    if (response.headers['set-cookie']) {
      response.headers['set-cookie'].forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        user.session.cookies.set(name, value);
      });
    }
    
    return response;
  }

  getConnectionDelay(connectionSpeed) {
    switch (connectionSpeed) {
      case 'fast': return Math.random() * 100; // 0-100ms
      case 'medium': return 100 + Math.random() * 300; // 100-400ms
      case 'slow': return 400 + Math.random() * 600; // 400-1000ms
      default: return 0;
    }
  }

  async simulateThinkTime(user, min = null, max = null) {
    const minTime = min || this.config.thinkTimeMin;
    const maxTime = max || this.config.thinkTimeMax;
    const thinkTime = minTime + Math.random() * (maxTime - minTime);
    
    user.stats.totalThinkTime += thinkTime;
    
    await new Promise(resolve => setTimeout(resolve, thinkTime));
  }

  // Error Handling and Metrics
  handleUserError(user, error, actionType, journey) {
    const action = {
      type: actionType,
      timestamp: Date.now(),
      error: error.message,
      success: false
    };
    
    journey.actions.push(action);
    user.stats.errorCount++;
    
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    
    // Track error types
    const errorType = error.response ? `HTTP_${error.response.status}` : error.code || 'UNKNOWN';
    this.metrics.errorTypes.set(errorType, (this.metrics.errorTypes.get(errorType) || 0) + 1);
    
    console.warn(`User ${user.id} ${actionType} error: ${error.message}`);
  }

  updateMetrics(action) {
    this.metrics.totalRequests++;
    
    if (action.success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    if (action.responseTime) {
      this.metrics.responseTimes.push(action.responseTime);
    }
  }

  // Load Pattern Generation
  async runLoadTest(pattern = 'steady') {
    console.log(`🚀 Starting realistic load test with ${pattern} pattern...`);
    
    const testStart = Date.now();
    const metricsCollector = this.startMetricsCollection();
    
    try {
      switch (pattern) {
        case 'ramp-up':
          await this.runRampUpPattern();
          break;
        case 'spike':
          await this.runSpikePattern();
          break;
        case 'steady':
          await this.runSteadyPattern();
          break;
        case 'stress':
          await this.runStressPattern();
          break;
        default:
          await this.runSteadyPattern();
      }
      
      // Wait for all active users to complete
      console.log('Waiting for active users to complete...');
      while (this.activeUsers.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Active users: ${this.activeUsers.size}`);
      }
      
    } finally {
      clearInterval(metricsCollector);
    }
    
    const testDuration = Date.now() - testStart;
    
    console.log('🏁 Load test completed');
    console.log(`Duration: ${(testDuration / 1000).toFixed(1)}s`);
    console.log(`Virtual Users: ${this.metrics.virtualUsers}`);
    console.log(`Total Requests: ${this.metrics.totalRequests}`);
    console.log(`Success Rate: ${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1)}%`);
    
    return await this.generateLoadTestReport(testStart, testDuration, pattern);
  }

  async runSteadyPattern() {
    const steadyUserCount = Math.floor(this.config.maxVirtualUsers * 0.7); // 70% of max
    const userCreationInterval = 2000; // Create user every 2 seconds
    
    console.log(`Maintaining steady load of ~${steadyUserCount} concurrent users`);
    
    const steadyInterval = setInterval(() => {
      if (this.activeUsers.size < steadyUserCount) {
        const usersToCreate = Math.min(3, steadyUserCount - this.activeUsers.size);
        for (let i = 0; i < usersToCreate; i++) {
          this.createVirtualUser(`steady-${Date.now()}-${i}`);
        }
      }
    }, userCreationInterval);
    
    await new Promise(resolve => setTimeout(resolve, this.config.testDuration));
    clearInterval(steadyInterval);
  }

  async runRampUpPattern() {
    const maxUsers = this.config.maxVirtualUsers;
    const rampUpTime = this.config.rampUpTime;
    const steadyTime = this.config.testDuration - rampUpTime - this.config.rampDownTime;
    
    console.log(`Ramping up to ${maxUsers} users over ${rampUpTime/1000}s`);
    
    // Ramp up phase
    const rampUpInterval = rampUpTime / maxUsers;
    for (let i = 0; i < maxUsers; i++) {
      this.createVirtualUser(`rampup-${i}`);
      await new Promise(resolve => setTimeout(resolve, rampUpInterval));
    }
    
    console.log(`Steady state for ${steadyTime/1000}s`);
    await new Promise(resolve => setTimeout(resolve, steadyTime));
    
    console.log('Ramp down phase...');
    // Users will naturally complete and ramp down
  }

  async runSpikePattern() {
    const baselineUsers = Math.floor(this.config.maxVirtualUsers * 0.3);
    const spikeUsers = this.config.maxVirtualUsers;
    
    console.log(`Starting with baseline ${baselineUsers} users`);
    
    // Baseline load
    for (let i = 0; i < baselineUsers; i++) {
      this.createVirtualUser(`baseline-${i}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30s baseline
    
    console.log(`Spike to ${spikeUsers} users!`);
    
    // Spike
    const additionalUsers = spikeUsers - baselineUsers;
    for (let i = 0; i < additionalUsers; i++) {
      this.createVirtualUser(`spike-${i}`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Faster creation
    }
    
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute spike
    
    console.log('Spike completed, returning to baseline');
  }

  async runStressPattern() {
    const stressUsers = Math.floor(this.config.maxVirtualUsers * 1.5); // 150% of normal max
    
    console.log(`Stress testing with ${stressUsers} users (150% of normal capacity)`);
    
    // Aggressive user creation
    for (let i = 0; i < stressUsers; i++) {
      this.createVirtualUser(`stress-${i}`);
      
      // Very short intervals to create stress
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, this.config.testDuration));
  }

  startMetricsCollection() {
    const interval = setInterval(() => {
      const currentMetrics = {
        timestamp: Date.now(),
        activeUsers: this.activeUsers.size,
        totalRequests: this.metrics.totalRequests,
        successfulRequests: this.metrics.successfulRequests,
        failedRequests: this.metrics.failedRequests,
        avgResponseTime: this.calculateAverageResponseTime(),
        throughput: this.calculateThroughput()
      };
      
      this.emit('metrics-update', currentMetrics);
      
      // Update throughput calculation
      this.metrics.throughput = currentMetrics.throughput;
      
    }, 5000); // Every 5 seconds
    
    return interval;
  }

  calculateAverageResponseTime() {
    if (this.metrics.responseTimes.length === 0) return 0;
    
    const recent = this.metrics.responseTimes.slice(-100); // Last 100 requests
    return recent.reduce((sum, time) => sum + time, 0) / recent.length;
  }

  calculateThroughput() {
    // Calculate requests per second over the last minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.completedJourneys
      .filter(journey => journey.endTime > oneMinuteAgo)
      .reduce((sum, journey) => sum + journey.actions.length, 0);
    
    return recentRequests / 60; // Requests per second
  }

  async generateLoadTestReport(startTime, duration, pattern) {
    const report = {
      testInfo: {
        pattern: pattern,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: duration,
        maxVirtualUsers: this.config.maxVirtualUsers
      },
      metrics: {
        ...this.metrics,
        averageResponseTime: this.calculateAverageResponseTime(),
        p95ResponseTime: this.calculatePercentile(this.metrics.responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(this.metrics.responseTimes, 99),
        errorRate: (this.metrics.failedRequests / this.metrics.totalRequests) * 100,
        throughput: this.metrics.throughput,
        completedJourneys: this.completedJourneys.length
      },
      userBehavior: this.analyzeUserBehavior(),
      performance: this.analyzePerformance(),
      recommendations: this.generatePerformanceRecommendations()
    };

    const reportPath = path.join(this.outputDir, `load-test-${pattern}-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`Load test report saved: ${reportPath}`);
    return reportPath;
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  analyzeUserBehavior() {
    const profileCounts = {};
    const averageSessionDurations = {};
    const averageActionsPerSession = {};
    
    for (const journey of this.completedJourneys) {
      const profile = journey.profile || 'unknown';
      
      profileCounts[profile] = (profileCounts[profile] || 0) + 1;
      
      if (!averageSessionDurations[profile]) {
        averageSessionDurations[profile] = [];
      }
      if (!averageActionsPerSession[profile]) {
        averageActionsPerSession[profile] = [];
      }
      
      averageSessionDurations[profile].push(journey.duration);
      averageActionsPerSession[profile].push(journey.actions.length);
    }
    
    // Calculate averages
    for (const profile in averageSessionDurations) {
      const durations = averageSessionDurations[profile];
      const actions = averageActionsPerSession[profile];
      
      averageSessionDurations[profile] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      averageActionsPerSession[profile] = actions.reduce((sum, a) => sum + a, 0) / actions.length;
    }
    
    return {
      profileDistribution: profileCounts,
      averageSessionDurations: averageSessionDurations,
      averageActionsPerSession: averageActionsPerSession
    };
  }

  analyzePerformance() {
    const actionTypes = {};
    
    for (const journey of this.completedJourneys) {
      for (const action of journey.actions) {
        if (!actionTypes[action.type]) {
          actionTypes[action.type] = {
            count: 0,
            totalResponseTime: 0,
            successCount: 0,
            errorCount: 0
          };
        }
        
        const stats = actionTypes[action.type];
        stats.count++;
        
        if (action.responseTime) {
          stats.totalResponseTime += action.responseTime;
        }
        
        if (action.success) {
          stats.successCount++;
        } else {
          stats.errorCount++;
        }
      }
    }
    
    // Calculate averages
    for (const type in actionTypes) {
      const stats = actionTypes[type];
      stats.averageResponseTime = stats.totalResponseTime / stats.count;
      stats.successRate = (stats.successCount / stats.count) * 100;
    }
    
    return {
      actionPerformance: actionTypes,
      errorBreakdown: Object.fromEntries(this.metrics.errorTypes)
    };
  }

  generatePerformanceRecommendations() {
    const recommendations = [];
    const avgResponseTime = this.calculateAverageResponseTime();
    const errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
    
    if (avgResponseTime > 2000) {
      recommendations.push('High average response time detected (>2s) - consider performance optimization');
    }
    
    if (errorRate > 5) {
      recommendations.push(`High error rate (${errorRate.toFixed(1)}%) - investigate error handling and system stability`);
    }
    
    if (this.metrics.throughput < 10) {
      recommendations.push('Low throughput - consider scaling infrastructure or optimizing bottlenecks');
    }
    
    const maxConcurrentUsers = Math.max(...Array.from(this.activeUsers).map(() => this.activeUsers.size));
    if (maxConcurrentUsers < this.config.maxVirtualUsers * 0.8) {
      recommendations.push('System may not have reached full capacity - consider increasing load');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System performed well under load - maintain current performance standards');
    }
    
    return recommendations;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const pattern = args[0] || 'steady';
  
  const options = {
    baseUrl: process.env.BASE_URL || 'http://localhost:4000',
    maxVirtualUsers: parseInt(process.env.MAX_USERS) || 50,
    testDuration: parseInt(process.env.TEST_DURATION) || 300000 // 5 minutes
  };

  const loadTester = new RealisticLoadTester(options);
  
  // Real-time metrics display
  loadTester.on('metrics-update', (metrics) => {
    console.log(`🔄 Active: ${metrics.activeUsers} | Requests: ${metrics.totalRequests} | Success: ${metrics.successfulRequests} | Errors: ${metrics.failedRequests} | Avg RT: ${metrics.avgResponseTime.toFixed(0)}ms | Throughput: ${metrics.throughput.toFixed(1)} req/s`);
  });
  
  try {
    await loadTester.initialize();
    const reportPath = await loadTester.runLoadTest(pattern);
    
    console.log(`✅ Load test completed successfully`);
    console.log(`📊 Report: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RealisticLoadTester;