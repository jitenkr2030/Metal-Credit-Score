/**
 * Metal Credit Score (MCS) API Server
 * India's First Asset-Backed Credit Scoring Engine
 * 
 * @author MiniMax Agent
 * @version 1.0.0
 * @date 2025-11-21
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { body: validationBody, param, query } = require('express-validator');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const http = require('http');
const winston = require('winston');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import MCS Services
const ScoringEngine = require('./services/scoring-engine');
const PortfolioFetcher = require('./services/portfolio-fetcher');
const BehaviorEngine = require('./services/behavior-engine');
const RiskEngine = require('./services/risk-engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize MCS Services
const scoringEngine = new ScoringEngine();
const portfolioFetcher = new PortfolioFetcher();
const behaviorEngine = new BehaviorEngine();
const riskEngine = new RiskEngine();

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mcs', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcs-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 200, // limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'mcs-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware (for NBFC dashboard access)
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'nbfc') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// WebSocket connection handling
const connectedClients = new Set();

wss.on('connection', (ws, req) => {
  const clientId = generateClientId();
  connectedClients.add({ id: clientId, ws, userId: null });
  
  logger.info(`WebSocket client connected: ${clientId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleWebSocketMessage(clientId, data);
    } catch (error) {
      logger.error(`WebSocket message error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    connectedClients.forEach(client => {
      if (client.id === clientId) {
        connectedClients.delete(client);
      }
    });
    logger.info(`WebSocket client disconnected: ${clientId}`);
  });
});

// ==================== API ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'MCS API'
  });
});

// Get credit score for user
app.get('/api/score/:userId', 
  authenticateToken,
  [
    param('userId').isAlphanumeric().withMessage('Valid user ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const userAddresses = req.query.addresses ? JSON.parse(req.query.addresses) : null;

      // Fetch complete portfolio
      const portfolio = await portfolioFetcher.fetchCompletePortfolio(userId, userAddresses);
      
      // Fetch transaction history for behavior analysis
      const transactionHistory = portfolio.transactionHistory || [];
      
      // Perform behavior analysis
      const behavior = await behaviorEngine.analyzeBehavior(userId, transactionHistory, portfolio);
      
      // Perform risk analysis
      const riskAnalysis = await riskEngine.performRiskAnalysis(
        userId, 
        transactionHistory, 
        portfolio, 
        { userId, location: req.query.location }
      );
      
      // Calculate final score
      const scoreResult = await scoringEngine.calculateScore(portfolio, behavior, riskAnalysis);
      
      // Save score to database (mock implementation)
      await saveScoreToDatabase(userId, scoreResult);

      res.json({
        success: true,
        data: {
          userId: userId,
          score: scoreResult.score,
          category: scoreResult.category,
          limit_recommendation: `₹${scoreResult.recommendation.maxAmount.toLocaleString()}`,
          reason: scoreResult.reasons,
          recommendation: scoreResult.recommendation,
          breakdown: scoreResult.breakdown,
          timestamp: scoreResult.timestamp,
          validityDays: scoreResult.validityDays
        }
      });
    } catch (error) {
      logger.error(`Score calculation error: ${error.message}`);
      res.status(500).json({ 
        error: 'Score calculation failed',
        message: error.message 
      });
    }
  }
);

// Batch score calculation (for NBFC use)
app.post('/api/score/batch',
  authenticateToken,
  requireAdmin,
  [
    body('userIds').isArray({ min: 1, max: 100 }).withMessage('User IDs array required (1-100 users)'),
    body('userIds.*').isAlphanumeric().withMessage('Valid user IDs required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userIds } = req.body;
      const results = [];

      // Process users in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (userId) => {
          try {
            // Mock user addresses - in real implementation, fetch from database
            const userAddresses = {
              gold: `gold_${userId}`,
              silver: `silver_${userId}`,
              platinum: `platinum_${userId}`,
              binr: `binr_${userId}`
            };

            // Fetch portfolio
            const portfolio = await portfolioFetcher.fetchCompletePortfolio(userId, userAddresses);
            const transactionHistory = portfolio.transactionHistory || [];
            
            // Analyze behavior and risk
            const behavior = await behaviorEngine.analyzeBehavior(userId, transactionHistory, portfolio);
            const riskAnalysis = await riskEngine.performRiskAnalysis(userId, transactionHistory, portfolio, {});
            
            // Calculate score
            const scoreResult = await scoringEngine.calculateScore(portfolio, behavior, riskAnalysis);
            
            return {
              userId,
              success: true,
              score: scoreResult.score,
              category: scoreResult.category,
              recommendation: scoreResult.recommendation
            };
          } catch (error) {
            return {
              userId,
              success: false,
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      res.json({
        success: true,
        data: {
          totalProcessed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results: results
        }
      });
    } catch (error) {
      logger.error(`Batch score calculation error: ${error.message}`);
      res.status(500).json({ 
        error: 'Batch score calculation failed',
        message: error.message 
      });
    }
  }
);

// Get user portfolio details
app.get('/api/portfolio/:userId',
  authenticateToken,
  [
    param('userId').isAlphanumeric().withMessage('Valid user ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const userAddresses = req.query.addresses ? JSON.parse(req.query.addresses) : null;

      const portfolio = await portfolioFetcher.fetchCompletePortfolio(userId, userAddresses);

      res.json({
        success: true,
        data: portfolio
      });
    } catch (error) {
      logger.error(`Portfolio fetch error: ${error.message}`);
      res.status(500).json({ 
        error: 'Portfolio fetch failed',
        message: error.message 
      });
    }
  }
);

// Get platform status
app.get('/api/platforms/status', async (req, res) => {
  try {
    const status = await portfolioFetcher.getPlatformStatus();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        platforms: status
      }
    });
  } catch (error) {
    logger.error(`Platform status error: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to get platform status',
      message: error.message 
    });
  }
});

// NBFC Admin Routes

// Get all user scores (admin only)
app.get('/api/admin/scores',
  authenticateToken,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('category').optional().isIn(['Excellent', 'Very Good', 'Good', 'Average', 'Fair', 'Poor', 'Very Poor'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const category = req.query.category;
      
      // Mock implementation - in real scenario, fetch from database
      const mockScores = generateMockScores(100);
      let filteredScores = mockScores;
      
      if (category) {
        filteredScores = mockScores.filter(score => score.category === category);
      }
      
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedScores = filteredScores.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          scores: paginatedScores,
          pagination: {
            page: page,
            limit: limit,
            total: filteredScores.length,
            pages: Math.ceil(filteredScores.length / limit)
          }
        }
      });
    } catch (error) {
      logger.error(`Admin scores fetch error: ${error.message}`);
      res.status(500).json({ 
        error: 'Failed to fetch scores',
        message: error.message 
      });
    }
  }
);

// Get loan eligibility calculator
app.post('/api/admin/loan-eligibility',
  authenticateToken,
  requireAdmin,
  [
    body('score').isInt({ min: 300, max: 900 }).withMessage('Valid score required (300-900)'),
    body('portfolioValue').isNumeric().withMessage('Valid portfolio value required'),
    body('monthlyIncome').optional().isNumeric().withMessage('Valid monthly income required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { score, portfolioValue, monthlyIncome } = req.body;
      
      // Generate loan eligibility based on score and portfolio
      const eligibility = calculateLoanEligibility(score, portfolioValue, monthlyIncome);

      res.json({
        success: true,
        data: eligibility
      });
    } catch (error) {
      logger.error(`Loan eligibility calculation error: ${error.message}`);
      res.status(500).json({ 
        error: 'Loan eligibility calculation failed',
        message: error.message 
      });
    }
  }
);

// Analytics endpoint
app.get('/api/admin/analytics',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      // Mock analytics data
      const analytics = {
        summary: {
          totalUsers: 15847,
          avgScore: 647,
          highRiskUsers: 892,
          activeUsers: 12456
        },
        scoreDistribution: {
          'Excellent': 1234,
          'Very Good': 2156,
          'Good': 3892,
          'Average': 4234,
          'Fair': 2678,
          'Poor': 1345,
          'Very Poor': 308
        },
        assetAllocation: {
          gold: 45.2,
          silver: 18.7,
          platinum: 8.1,
          binr: 28.0
        },
        platformHealth: await portfolioFetcher.getPlatformStatus()
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error(`Analytics fetch error: ${error.message}`);
      res.status(500).json({
        error: 'Failed to fetch analytics',
        message: error.message
      });
    }
  }
);

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique client ID for WebSocket
 */
function generateClientId() {
  return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Handle WebSocket messages
 */
async function handleWebSocketMessage(clientId, data) {
  // WebSocket message handling logic
  if (data.type === 'subscribe') {
    // Subscribe to user score updates
    console.log(`Client ${clientId} subscribed to user ${data.userId}`);
  } else if (data.type === 'get_score') {
    // Real-time score request
    console.log(`Client ${clientId} requested score for user ${data.userId}`);
  }
}

/**
 * Save score to database (mock implementation)
 */
async function saveScoreToDatabase(userId, scoreResult) {
  // In a real implementation, this would save to MongoDB
  logger.info(`Score saved for user ${userId}: ${scoreResult.score}`);
}

/**
 * Generate mock scores for admin dashboard
 */
function generateMockScores(count) {
  const scores = [];
  const categories = ['Excellent', 'Very Good', 'Good', 'Average', 'Fair', 'Poor', 'Very Poor'];
  
  for (let i = 0; i < count; i++) {
    const score = Math.floor(Math.random() * 600) + 300; // 300-900
    const category = score >= 800 ? 'Excellent' :
                    score >= 750 ? 'Very Good' :
                    score >= 700 ? 'Good' :
                    score >= 650 ? 'Average' :
                    score >= 600 ? 'Fair' :
                    score >= 550 ? 'Poor' : 'Very Poor';
    
    scores.push({
      userId: `user_${i + 1}`,
      score: score,
      category: category,
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      recommendation: {
        maxAmount: Math.floor(Math.random() * 50000) + 10000,
        maxPercentage: Math.floor(Math.random() * 30) + 40 + '%'
      }
    });
  }
  
  return scores;
}

/**
 * Calculate loan eligibility
 */
function calculateLoanEligibility(score, portfolioValue, monthlyIncome) {
  let maxLoanPercentage;
  let baseAmount;

  if (score >= 800) {
    maxLoanPercentage = 0.75;
    baseAmount = 50000;
  } else if (score >= 750) {
    maxLoanPercentage = 0.70;
    baseAmount = 40000;
  } else if (score >= 700) {
    maxLoanPercentage = 0.65;
    baseAmount = 35000;
  } else if (score >= 650) {
    maxLoanPercentage = 0.60;
    baseAmount = 25000;
  } else if (score >= 600) {
    maxLoanPercentage = 0.55;
    baseAmount = 20000;
  } else if (score >= 550) {
    maxLoanPercentage = 0.50;
    baseAmount = 15000;
  } else {
    maxLoanPercentage = 0.40;
    baseAmount = 10000;
  }

  const assetBasedLoan = portfolioValue * maxLoanPercentage;
  const recommendedAmount = Math.min(assetBasedLoan, baseAmount);

  return {
    recommendedAmount: Math.round(recommendedAmount),
    maxPercentage: (maxLoanPercentage * 100).toFixed(0) + '%',
    interestRate: getInterestRate(score),
    tenure: getTenure(score),
    eligibility: score >= 550 ? 'Eligible' : 'Not Eligible',
    riskLevel: score >= 700 ? 'Low' : score >= 600 ? 'Medium' : 'High'
  };
}

/**
 * Get interest rate based on score
 */
function getInterestRate(score) {
  if (score >= 800) return "12-14%";
  if (score >= 750) return "14-16%";
  if (score >= 700) return "16-18%";
  if (score >= 650) return "18-20%";
  if (score >= 600) return "20-22%";
  if (score >= 550) return "22-24%";
  return "24-26%";
}

/**
 * Get tenure based on score
 */
function getTenure(score) {
  if (score >= 750) return "36 months";
  if (score >= 700) return "24 months";
  if (score >= 650) return "18 months";
  if (score >= 600) return "12 months";
  return "6 months";
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 3005;

server.listen(PORT, () => {
  logger.info(`MCS API Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/mcs'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    logger.info('Process terminated');
  });
});

module.exports = app;