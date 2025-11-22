/**
 * Risk Engine Service
 * Performs risk analysis and fraud detection for MCS scoring
 * 
 * @author MiniMax Agent
 * @version 1.0.0
 * @date 2025-11-21
 */

const EventEmitter = require('events');

class RiskEngine extends EventEmitter {
  constructor() {
    super();
    this.RISK_THRESHOLDS = {
      largeWithdrawal: 50000, // ₹50,000
      suspiciousActivity: {
        frequency: 10, // transactions per day
        amount: 100000, // ₹100,000
        timeWindow: 24 // hours
      },
      inactivePeriod: 90, // days
      unusualPattern: {
        deviation: 3, // standard deviations
        minTransactions: 5
      }
    };

    this.RISK_WEIGHTS = {
      withdrawalPatterns: 0.30,
      fraudIndicators: 0.40,
      walletCount: 0.15,
      activityLevel: 0.10,
      unusualTransactions: 0.05
    };
  }

  /**
   * Perform comprehensive risk analysis
   * @param {string} userId - User identifier
   * @param {Object} transactionHistory - Complete transaction history
   * @param {Object} portfolioData - Current portfolio data
   * @param {Object} userProfile - User profile information
   * @returns {Object} Risk analysis results
   */
  async performRiskAnalysis(userId, transactionHistory, portfolioData, userProfile) {
    try {
      const riskAnalysis = {
        userId: userId,
        timestamp: new Date().toISOString(),
        withdrawalPatterns: this.analyzeWithdrawalPatterns(transactionHistory),
        fraudIndicators: this.detectFraudulentActivity(transactionHistory, userProfile),
        walletCount: this.analyzeWalletUsage(userId, portfolioData),
        activityLevel: this.analyzeActivityLevel(transactionHistory),
        unusualTransactions: this.detectUnusualTransactions(transactionHistory),
        geographicalRisk: this.analyzeGeographicalRisk(userProfile),
        velocityAnalysis: this.performVelocityAnalysis(transactionHistory),
        behavioralAnomalies: this.detectBehavioralAnomalies(transactionHistory, portfolioData)
      };

      // Calculate overall risk score
      riskAnalysis.overallRiskScore = this.calculateOverallRiskScore(riskAnalysis);
      riskAnalysis.riskLevel = this.determineRiskLevel(riskAnalysis.overallRiskScore);
      riskAnalysis.riskFactors = this.identifyRiskFactors(riskAnalysis);

      // Emit risk analysis completed event
      this.emit('riskAnalysisCompleted', { userId, riskAnalysis });

      return riskAnalysis;
    } catch (error) {
      throw new Error(`Risk analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze withdrawal patterns for risk indicators
   */
  analyzeWithdrawalPatterns(transactionHistory) {
    const withdrawals = transactionHistory.filter(tx => 
      tx.type === 'withdrawal' || tx.type === 'sale'
    );

    if (withdrawals.length === 0) {
      return {
        largeWithdrawals: 0,
        frequentWithdrawals: 0,
        suddenPattern: false,
        maxWithdrawal: 0,
        totalWithdrawn: 0,
        withdrawalFrequency: 0,
        riskScore: 0
      };
    }

    const withdrawalAmounts = withdrawals.map(w => w.amount);
    const totalWithdrawn = withdrawalAmounts.reduce((sum, amount) => sum + amount, 0);
    const maxWithdrawal = Math.max(...withdrawalAmounts);

    // Analyze large withdrawals
    const largeWithdrawals = withdrawals.filter(w => w.amount >= this.RISK_THRESHOLDS.largeWithdrawal);

    // Analyze frequency
    const withdrawalDates = withdrawals.map(w => new Date(w.timestamp));
    withdrawalDates.sort((a, b) => a - b);
    
    const timeIntervals = [];
    for (let i = 1; i < withdrawalDates.length; i++) {
      const interval = withdrawalDates[i] - withdrawalDates[i-1];
      timeIntervals.push(interval / (1000 * 60 * 60 * 24)); // Convert to days
    }

    const avgInterval = timeIntervals.length > 0 ? 
      timeIntervals.reduce((sum, days) => sum + days, 0) / timeIntervals.length : 0;
    const frequentWithdrawals = avgInterval < 7 ? withdrawalDates.length : 0;

    // Detect sudden pattern (multiple large withdrawals in short time)
    let suddenPattern = false;
    let consecutiveLarge = 0;
    let maxConsecutive = 0;

    for (let i = 0; i < withdrawals.length; i++) {
      if (withdrawals[i].amount >= this.RISK_THRESHOLDS.largeWithdrawal) {
        consecutiveLarge++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveLarge);
      } else {
        consecutiveLarge = 0;
      }
    }
    suddenPattern = maxConsecutive >= 3;

    // Calculate withdrawal frequency
    const firstWithdrawal = withdrawalDates[0];
    const lastWithdrawal = withdrawalDates[withdrawalDates.length - 1];
    const totalDays = (lastWithdrawal - firstWithdrawal) / (1000 * 60 * 60 * 24);
    const withdrawalFrequency = totalDays > 0 ? withdrawals.length / (totalDays / 30) : 0; // per month

    return {
      largeWithdrawals: largeWithdrawals.length,
      frequentWithdrawals: frequentWithdrawals,
      suddenPattern: suddenPattern,
      maxWithdrawal: maxWithdrawal,
      totalWithdrawn: totalWithdrawn,
      withdrawalFrequency: Math.round(withdrawalFrequency * 100) / 100,
      maxConsecutiveLarge: maxConsecutive,
      avgInterval: Math.round(avgInterval * 100) / 100,
      riskScore: this.calculateWithdrawalRiskScore(largeWithdrawals.length, frequentWithdrawals, suddenPattern)
    };
  }

  /**
   * Detect fraudulent activity patterns
   */
  detectFraudulentActivity(transactionHistory, userProfile) {
    const transactions = transactionHistory;
    let riskScore = 0;
    const indicators = [];

    // Check for unusual transaction amounts
    const amounts = transactions.map(tx => tx.amount);
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - avgAmount, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    const suspiciousAmounts = transactions.filter(tx => 
      Math.abs(tx.amount - avgAmount) > (3 * stdDev) && tx.amount > avgAmount * 2
    );

    if (suspiciousAmounts.length > 0) {
      riskScore += suspiciousAmounts.length * 10;
      indicators.push('unusual-amounts');
    }

    // Check for time-based anomalies
    const unusualTimeTransactions = this.detectUnusualTimePatterns(transactions);
    if (unusualTimeTransactions.length > 0) {
      riskScore += unusualTimeTransactions.length * 5;
      indicators.push('unusual-timing');
    }

    // Check for rapid-fire transactions
    const rapidTransactions = this.detectRapidTransactions(transactions);
    if (rapidTransactions.length > 0) {
      riskScore += rapidTransactions.length * 15;
      indicators.push('rapid-transactions');
    }

    // Check for circular transactions (self-trading)
    const circularTransactions = this.detectCircularTransactions(transactions);
    if (circularTransactions.length > 0) {
      riskScore += circularTransactions.length * 20;
      indicators.push('circular-transactions');
    }

    // Check for geolocation inconsistencies (if profile has location data)
    if (userProfile && userProfile.locations) {
      const locationRisk = this.analyzeLocationConsistency(transactions, userProfile.locations);
      riskScore += locationRisk.score;
      if (locationRisk.indicators.length > 0) {
        indicators.push(...locationRisk.indicators);
      }
    }

    // Check for device/IP inconsistencies (mock implementation)
    const deviceRisk = this.analyzeDeviceConsistency(transactions);
    riskScore += deviceRisk.score;
    if (deviceRisk.indicators.length > 0) {
      indicators.push(...deviceRisk.indicators);
    }

    return {
      suspiciousActivity: indicators.length,
      indicators: indicators,
      score: Math.min(100, riskScore),
      severity: this.determineSeverity(riskScore),
      details: {
        unusualAmounts: suspiciousAmounts.length,
        unusualTimeTransactions: unusualTimeTransactions.length,
        rapidTransactions: rapidTransactions.length,
        circularTransactions: circularTransactions.length
      }
    };
  }

  /**
   * Analyze wallet usage patterns
   */
  analyzeWalletUsage(userId, portfolioData) {
    const wallets = [];
    
    if (portfolioData.gold?.address) wallets.push({ type: 'gold', address: portfolioData.gold.address });
    if (portfolioData.silver?.address) wallets.push({ type: 'silver', address: portfolioData.silver.address });
    if (portfolioData.platinum?.address) wallets.push({ type: 'platinum', address: portfolioData.platinum.address });
    if (portfolioData.binr?.address) wallets.push({ type: 'binr', address: portfolioData.binr.address });

    const walletCount = wallets.length;
    const multiChainUsage = new Set(wallets.map(w => w.type)).size;
    
    let riskScore = 0;
    const indicators = [];

    // Too many wallets
    if (walletCount > 4) {
      riskScore += 15;
      indicators.push('excessive-wallets');
    }

    // Frequent wallet changes (mock implementation)
    const frequentChanges = this.detectFrequentWalletChanges(userId, wallets);
    if (frequentChanges) {
      riskScore += 10;
      indicators.push('frequent-wallet-changes');
    }

    return {
      count: walletCount,
      types: Array.from(new Set(wallets.map(w => w.type))),
      multiChainUsage: multiChainUsage,
      indicators: indicators,
      riskScore: Math.min(20, riskScore)
    };
  }

  /**
   * Analyze user activity level
   */
  analyzeActivityLevel(transactionHistory) {
    if (transactionHistory.length === 0) {
      return {
        daysSinceLastActivity: 365,
        activityFrequency: 0,
        activeMonths: 0,
        riskScore: 20
      };
    }

    const transactions = transactionHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lastTransaction = new Date(transactions[0].timestamp);
    const daysSinceLastActivity = Math.floor((new Date() - lastTransaction) / (1000 * 60 * 60 * 24));

    // Calculate activity frequency
    const firstTransaction = new Date(transactions[transactions.length - 1].timestamp);
    const totalDays = (new Date() - firstTransaction) / (1000 * 60 * 60 * 24);
    const activityFrequency = transactions.length / Math.max(totalDays, 1);

    // Calculate active months
    const monthlyActivity = new Set();
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyActivity.add(monthYear);
    });

    const activeMonths = monthlyActivity.size;

    let riskScore = 0;
    if (daysSinceLastActivity > this.RISK_THRESHOLDS.inactivePeriod) {
      riskScore = 20;
    } else if (daysSinceLastActivity > 30) {
      riskScore = 10;
    }

    return {
      daysSinceLastActivity: daysSinceLastActivity,
      activityFrequency: Math.round(activityFrequency * 100) / 100,
      totalTransactions: transactions.length,
      activeMonths: activeMonths,
      riskScore: riskScore
    };
  }

  /**
   * Detect unusual transactions
   */
  detectUnusualTransactions(transactionHistory) {
    const transactions = transactionHistory;
    const unusualTransactions = [];
    
    if (transactions.length < this.RISK_THRESHOLDS.unusualPattern.minTransactions) {
      return {
        count: 0,
        patterns: [],
        riskScore: 0
      };
    }

    // Analyze amounts for outliers
    const amounts = transactions.map(tx => tx.amount);
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Find amount outliers
    const amountOutliers = transactions.filter(tx => 
      Math.abs(tx.amount - mean) > (this.RISK_THRESHOLDS.unusualPattern.deviation * stdDev)
    );

    if (amountOutliers.length > 0) {
      unusualTransactions.push(...amountOutliers);
    }

    // Analyze timing patterns
    const timingOutliers = this.detectTimingOutliers(transactions);
    if (timingOutliers.length > 0) {
      unusualTransactions.push(...timingOutliers);
    }

    // Remove duplicates
    const uniqueUnusual = unusualTransactions.filter((tx, index, self) => 
      index === self.findIndex(t => t.id === tx.id)
    );

    return {
      count: uniqueUnusual.length,
      patterns: this.identifyUnusualPatterns(uniqueUnusual),
      riskScore: Math.min(15, uniqueUnusual.length * 3),
      outliers: uniqueUnusual.slice(0, 10) // Limit to first 10 for performance
    };
  }

  /**
   * Analyze geographical risk
   */
  analyzeGeographicalRisk(userProfile) {
    // Mock implementation - in real scenario, this would use IP geolocation, 
    // device location data, etc.
    let riskScore = 0;
    const indicators = [];

    if (!userProfile || !userProfile.location) {
      riskScore = 5;
      indicators.push('location-unknown');
      return { score: riskScore, indicators };
    }

    // Check for high-risk locations (mock)
    const highRiskLocations = ['VPN-UNKNOWN', 'TOR-EXIT', 'SUSPICIOUS-REGION'];
    if (highRiskLocations.includes(userProfile.location)) {
      riskScore += 20;
      indicators.push('high-risk-location');
    }

    // Check for location consistency (mock)
    const locationConsistency = this.checkLocationConsistency(userProfile);
    if (!locationConsistency.consistent) {
      riskScore += 10;
      indicators.push('location-inconsistent');
    }

    return {
      score: riskScore,
      indicators: indicators,
      location: userProfile.location,
      consistency: locationConsistency
    };
  }

  /**
   * Perform velocity analysis
   */
  performVelocityAnalysis(transactionHistory) {
    const transactions = transactionHistory;
    const velocityMetrics = {};

    // Daily velocity
    const dailyTransactions = this.calculateDailyVelocity(transactions);
    velocityMetrics.daily = dailyTransactions;

    // Weekly velocity
    const weeklyTransactions = this.calculateWeeklyVelocity(transactions);
    velocityMetrics.weekly = weeklyTransactions;

    // Monthly velocity
    const monthlyTransactions = this.calculateMonthlyVelocity(transactions);
    velocityMetrics.monthly = monthlyTransactions;

    // Risk assessment
    let riskScore = 0;
    if (dailyTransactions.count > this.RISK_THRESHOLDS.suspiciousActivity.frequency) {
      riskScore += 20;
    }

    return {
      metrics: velocityMetrics,
      riskScore: Math.min(25, riskScore)
    };
  }

  /**
   * Detect behavioral anomalies
   */
  detectBehavioralAnomalies(transactionHistory, portfolioData) {
    const anomalies = [];
    let riskScore = 0;

    // Check for investment pattern changes
    const patternChange = this.detectInvestmentPatternChange(transactionHistory);
    if (patternChange.anomaly) {
      anomalies.push('investment-pattern-change');
      riskScore += patternChange.severity * 5;
    }

    // Check for sudden portfolio changes
    const portfolioChange = this.detectSuddenPortfolioChange(transactionHistory, portfolioData);
    if (portfolioChange.anomaly) {
      anomalies.push('sudden-portfolio-change');
      riskScore += portfolioChange.severity * 10;
    }

    // Check for trading behavior changes
    const tradingChange = this.detectTradingBehaviorChange(transactionHistory);
    if (tradingChange.anomaly) {
      anomalies.push('trading-behavior-change');
      riskScore += tradingChange.severity * 8;
    }

    return {
      anomalies: anomalies,
      riskScore: Math.min(20, riskScore),
      details: {
        patternChange: patternChange,
        portfolioChange: portfolioChange,
        tradingChange: tradingChange
      }
    };
  }

  /**
   * Helper method: Calculate withdrawal risk score
   */
  calculateWithdrawalRiskScore(largeWithdrawals, frequentWithdrawals, suddenPattern) {
    let score = 0;
    
    if (largeWithdrawals > 0) {
      score += Math.min(largeWithdrawals * 10, 30);
    }
    
    if (frequentWithdrawals > 0) {
      score += Math.min(frequentWithdrawals * 5, 20);
    }
    
    if (suddenPattern) {
      score += 15;
    }
    
    return Math.min(40, score);
  }

  /**
   * Helper method: Detect unusual time patterns
   */
  detectUnusualTimePatterns(transactions) {
    const unusualTransactions = [];
    
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      
      // Flag transactions at unusual hours (e.g., 2-5 AM)
      if (hour >= 2 && hour <= 5) {
        unusualTransactions.push(tx);
      }
    });
    
    return unusualTransactions;
  }

  /**
   * Helper method: Detect rapid transactions
   */
  detectRapidTransactions(transactions) {
    const rapidTransactions = [];
    const sortedTransactions = transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    for (let i = 1; i < sortedTransactions.length; i++) {
      const timeDiff = new Date(sortedTransactions[i].timestamp) - new Date(sortedTransactions[i-1].timestamp);
      
      // Flag transactions within 1 minute
      if (timeDiff < 60000) {
        rapidTransactions.push(sortedTransactions[i]);
      }
    }
    
    return rapidTransactions;
  }

  /**
   * Helper method: Detect circular transactions
   */
  detectCircularTransactions(transactions) {
    // Mock implementation - detect transactions that appear to be self-trading
    const circularTransactions = transactions.filter(tx => 
      tx.from && tx.to && tx.from === tx.to
    );
    
    return circularTransactions;
  }

  /**
   * Helper method: Analyze location consistency
   */
  analyzeLocationConsistency(transactions, userLocations) {
    // Mock implementation
    return {
      consistent: true,
      score: 0,
      indicators: []
    };
  }

  /**
   * Helper method: Analyze device consistency
   */
  analyzeDeviceConsistency(transactions) {
    // Mock implementation - in real scenario, this would check IP addresses, device fingerprints, etc.
    return {
      consistent: true,
      score: 0,
      indicators: []
    };
  }

  /**
   * Helper method: Detect frequent wallet changes
   */
  detectFrequentWalletChanges(userId, wallets) {
    // Mock implementation - in real scenario, this would track wallet change history
    return false;
  }

  /**
   * Helper method: Check location consistency
   */
  checkLocationConsistency(userProfile) {
    // Mock implementation
    return {
      consistent: true,
      score: 0,
      details: 'Location consistency check passed'
    };
  }

  /**
   * Helper method: Detect timing outliers
   */
  detectTimingOutliers(transactions) {
    const outliers = [];
    const hours = transactions.map(tx => new Date(tx.timestamp).getHours());
    
    // Find hours that are statistical outliers
    const mean = hours.reduce((sum, h) => sum + h, 0) / hours.length;
    const variance = hours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hours.length;
    const stdDev = Math.sqrt(variance);
    
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      if (Math.abs(hour - mean) > (2 * stdDev)) {
        outliers.push(tx);
      }
    });
    
    return outliers;
  }

  /**
   * Helper method: Identify unusual patterns
   */
  identifyUnusualPatterns(transactions) {
    const patterns = [];
    
    if (transactions.length > 0) {
      const amounts = transactions.map(tx => tx.amount);
      const maxAmount = Math.max(...amounts);
      
      if (maxAmount > 100000) {
        patterns.push('large-amounts');
      }
      
      const hours = transactions.map(tx => new Date(tx.timestamp).getHours());
      const unusualHours = hours.filter(h => h < 6 || h > 23);
      
      if (unusualHours.length > transactions.length * 0.3) {
        patterns.push('unusual-timing');
      }
    }
    
    return patterns;
  }

  /**
   * Helper method: Calculate daily velocity
   */
  calculateDailyVelocity(transactions) {
    const dailyCounts = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp).toDateString();
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });
    
    const counts = Object.values(dailyCounts);
    const avgDaily = counts.length > 0 ? counts.reduce((sum, count) => sum + count, 0) / counts.length : 0;
    
    return {
      count: Math.round(avgDaily),
      max: Math.max(...counts),
      min: Math.min(...counts)
    };
  }

  /**
   * Helper method: Calculate weekly velocity
   */
  calculateWeeklyVelocity(transactions) {
    const weeklyCounts = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toDateString();
      weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
    });
    
    const counts = Object.values(weeklyCounts);
    const avgWeekly = counts.length > 0 ? counts.reduce((sum, count) => sum + count, 0) / counts.length : 0;
    
    return {
      count: Math.round(avgWeekly),
      max: Math.max(...counts),
      min: Math.min(...counts)
    };
  }

  /**
   * Helper method: Calculate monthly velocity
   */
  calculateMonthlyVelocity(transactions) {
    const monthlyCounts = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
    });
    
    const counts = Object.values(monthlyCounts);
    const avgMonthly = counts.length > 0 ? counts.reduce((sum, count) => sum + count, 0) / counts.length : 0;
    
    return {
      count: Math.round(avgMonthly),
      max: Math.max(...counts),
      min: Math.min(...counts)
    };
  }

  /**
   * Helper method: Detect investment pattern change
   */
  detectInvestmentPatternChange(transactions) {
    // Mock implementation - analyze changes in investment patterns over time
    return {
      anomaly: false,
      severity: 0,
      description: 'No significant pattern changes detected'
    };
  }

  /**
   * Helper method: Detect sudden portfolio changes
   */
  detectSuddenPortfolioChange(transactions, portfolioData) {
    // Mock implementation - detect dramatic changes in portfolio value or composition
    return {
      anomaly: false,
      severity: 0,
      description: 'No sudden portfolio changes detected'
    };
  }

  /**
   * Helper method: Detect trading behavior changes
   */
  detectTradingBehaviorChange(transactions) {
    // Mock implementation - analyze changes in trading frequency or patterns
    return {
      anomaly: false,
      severity: 0,
      description: 'No significant trading behavior changes detected'
    };
  }

  /**
   * Helper method: Determine severity
   */
  determineSeverity(riskScore) {
    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall risk score
   */
  calculateOverallRiskScore(riskAnalysis) {
    let totalScore = 0;
    
    totalScore += riskAnalysis.withdrawalPatterns.riskScore * this.RISK_WEIGHTS.withdrawalPatterns;
    totalScore += riskAnalysis.fraudIndicators.score * this.RISK_WEIGHTS.fraudIndicators;
    totalScore += riskAnalysis.walletCount.riskScore * this.RISK_WEIGHTS.walletCount;
    totalScore += riskAnalysis.activityLevel.riskScore * this.RISK_WEIGHTS.activityLevel;
    totalScore += riskAnalysis.unusualTransactions.riskScore * this.RISK_WEIGHTS.unusualTransactions;
    
    // Add additional risk factors
    totalScore += riskAnalysis.geographicalRisk.score;
    totalScore += riskAnalysis.velocityAnalysis.riskScore;
    totalScore += riskAnalysis.behavioralAnomalies.riskScore;
    
    return Math.min(100, totalScore);
  }

  /**
   * Determine risk level
   */
  determineRiskLevel(riskScore) {
    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    if (riskScore >= 20) return 'low';
    return 'minimal';
  }

  /**
   * Identify key risk factors
   */
  identifyRiskFactors(riskAnalysis) {
    const factors = [];
    
    if (riskAnalysis.withdrawalPatterns.riskScore > 20) {
      factors.push('High withdrawal risk');
    }
    
    if (riskAnalysis.fraudIndicators.score > 30) {
      factors.push('Fraud indicators detected');
    }
    
    if (riskAnalysis.activityLevel.daysSinceLastActivity > 90) {
      factors.push('Inactive account');
    }
    
    if (riskAnalysis.unusualTransactions.count > 5) {
      factors.push('Unusual transaction patterns');
    }
    
    if (riskAnalysis.geographicalRisk.score > 10) {
      factors.push('Geographical risk factors');
    }
    
    return factors;
  }
}

module.exports = RiskEngine;