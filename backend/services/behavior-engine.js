/**
 * Behavior Engine Service
 * Analyzes user transaction patterns and investment behavior
 * 
 * @author MiniMax Agent
 * @version 1.0.0
 * @date 2025-11-21
 */

const EventEmitter = require('events');

class BehaviorEngine extends EventEmitter {
  constructor() {
    super();
    this.SIP_THRESHOLD_DAYS = 7; // Weekly SIP threshold
    this.MONTHLY_STREAK_MONTHS = 12;
    this.PANIC_SELLING_DAYS = 7; // Selling within 7 days of purchase
    this.VOLATILITY_THRESHOLD = 0.15; // 15% price change threshold
  }

  /**
   * Analyze user behavior patterns
   * @param {string} userId - User identifier
   * @param {Object} transactionHistory - Complete transaction history
   * @param {Object} portfolioData - Current portfolio data
   * @returns {Object} Behavior analysis results
   */
  async analyzeBehavior(userId, transactionHistory, portfolioData) {
    try {
      const behavior = {
        userId: userId,
        timestamp: new Date().toISOString(),
        dailyWeeklySIP: this.analyzeSIPBehavior(transactionHistory, portfolioData),
        monthlyStreak: this.analyzeMonthlyStreak(transactionHistory),
        volatilityWithdrawals: this.analyzeVolatilityPatterns(transactionHistory),
        holdingDuration: this.analyzeHoldingPatterns(transactionHistory),
        panicSellingEvents: this.analyzePanicSelling(transactionHistory),
        investmentPatterns: this.analyzeInvestmentPatterns(transactionHistory),
        consistency: this.calculateConsistencyScore(transactionHistory),
        riskTolerance: this.analyzeRiskTolerance(transactionHistory, portfolioData)
      };

      // Calculate overall behavior score
      behavior.overallScore = this.calculateBehaviorScore(behavior);

      // Emit behavior analyzed event
      this.emit('behaviorAnalyzed', { userId, behavior });

      return behavior;
    } catch (error) {
      throw new Error(`Behavior analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze SIP (Systematic Investment Plan) behavior
   */
  analyzeSIPBehavior(transactionHistory, portfolioData) {
    const sipTransactions = transactionHistory.filter(tx => 
      tx.type === 'purchase' && tx.sipContribution === true
    );

    if (sipTransactions.length === 0) {
      return {
        active: false,
        consistency: 0,
        avgAmount: 0,
        frequency: 'none',
        streak: 0,
        totalContributions: 0
      };
    }

    // Group transactions by date
    const transactionsByDate = this.groupTransactionsByDate(sipTransactions);
    
    // Analyze frequency
    const frequency = this.calculateSIPFrequency(transactionsByDate);
    
    // Calculate consistency
    const consistency = this.calculateSIPConsistency(transactionsByDate, frequency);
    
    // Calculate current streak
    const streak = this.calculateCurrentStreak(transactionsByDate);
    
    // Calculate average amount
    const avgAmount = sipTransactions.reduce((sum, tx) => sum + tx.amount, 0) / sipTransactions.length;

    return {
      active: true,
      consistency: consistency,
      avgAmount: avgAmount,
      frequency: frequency,
      streak: streak,
      totalContributions: sipTransactions.length,
      totalAmount: sipTransactions.reduce((sum, tx) => sum + tx.amount, 0),
      lastContribution: sipTransactions[0]?.timestamp || null
    };
  }

  /**
   * Analyze monthly investment streak
   */
  analyzeMonthlyStreak(transactionHistory) {
    const purchaseTransactions = transactionHistory.filter(tx => tx.type === 'purchase');
    
    if (purchaseTransactions.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalMonths: 0,
        consistency: 0
      };
    }

    // Group by month-year
    const monthlyPurchases = this.groupByMonthYear(purchaseTransactions);
    const monthsWithPurchases = Object.keys(monthlyPurchases).sort();
    
    if (monthsWithPurchases.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalMonths: 0,
        consistency: 0
      };
    }

    // Calculate current streak
    const currentStreak = this.calculateCurrentMonthStreak(monthsWithPurchases);
    
    // Calculate longest streak
    const longestStreak = this.calculateLongestStreak(monthsWithPurchases);
    
    // Calculate total months and consistency
    const totalMonths = monthsWithPurchases.length;
    const timeSpan = this.calculateTimeSpanInMonths(monthsWithPurchases);
    const consistency = totalMonths > 0 ? (totalMonths / Math.max(timeSpan, 1)) : 0;

    return {
      currentStreak: currentStreak,
      longestStreak: longestStreak,
      totalMonths: totalMonths,
      consistency: Math.min(consistency, 1),
      months: monthsWithPurchases
    };
  }

  /**
   * Analyze volatility withdrawal patterns
   */
  analyzeVolatilityPatterns(transactionHistory) {
    const withdrawalTransactions = transactionHistory.filter(tx => tx.type === 'withdrawal');
    
    if (withdrawalTransactions.length === 0) {
      return {
        volatility: 0,
        pattern: 'low',
        withdrawals: withdrawalTransactions.length
      };
    }

    // Calculate withdrawal amounts and frequency
    const amounts = withdrawalTransactions.map(tx => tx.amount);
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const volatility = this.calculateVolatility(amounts);
    
    // Analyze withdrawal pattern
    let pattern = 'low';
    if (volatility > 0.5) pattern = 'high';
    else if (volatility > 0.25) pattern = 'medium';

    return {
      volatility: volatility,
      pattern: pattern,
      withdrawals: withdrawalTransactions.length,
      avgWithdrawal: avgAmount,
      maxWithdrawal: Math.max(...amounts),
      totalWithdrawn: amounts.reduce((sum, amount) => sum + amount, 0)
    };
  }

  /**
   * Analyze asset holding patterns
   */
  analyzeHoldingPatterns(transactionHistory) {
    const holdingAnalysis = {};
    const assetTypes = ['gold', 'silver', 'platinum', 'binr'];
    
    for (const asset of assetTypes) {
      const assetTransactions = transactionHistory.filter(tx => tx.platform === asset);
      
      if (assetTransactions.length === 0) continue;

      const holdings = this.calculateHoldings(assetTransactions);
      holdingAnalysis[asset] = {
        avgHoldingDays: holdings.avgDays,
        minHoldingDays: holdings.minDays,
        maxHoldingDays: holdings.maxDays,
        totalTransactions: assetTransactions.length,
        longTermPercentage: holdings.longTermPercentage
      };
    }

    // Calculate overall metrics
    const allHoldings = Object.values(holdingAnalysis).map(h => h.avgHoldingDays).filter(days => days > 0);
    const avgHoldingDays = allHoldings.length > 0 ? 
      allHoldings.reduce((sum, days) => sum + days, 0) / allHoldings.length : 0;

    return {
      assetHoldings: holdingAnalysis,
      averageDays: Math.round(avgHoldingDays),
      overallPattern: avgHoldingDays > 180 ? 'long-term' : avgHoldingDays > 30 ? 'medium-term' : 'short-term'
    };
  }

  /**
   * Analyze panic selling events
   */
  analyzePanicSelling(transactionHistory) {
    const purchases = transactionHistory.filter(tx => tx.type === 'purchase');
    const sales = transactionHistory.filter(tx => tx.type === 'sale' || tx.type === 'withdrawal');
    
    let panicSellingEvents = 0;
    const panicEvents = [];

    for (const sale of sales) {
      // Find purchases of the same asset within panic selling window
      const assetPurchases = purchases.filter(p => 
        p.platform === sale.platform && 
        new Date(sale.timestamp) - new Date(p.timestamp) <= (this.PANIC_SELLING_DAYS * 24 * 60 * 60 * 1000)
      );

      if (assetPurchases.length > 0) {
        panicSellingEvents++;
        panicEvents.push({
          saleDate: sale.timestamp,
          purchaseDates: assetPurchases.map(p => p.timestamp),
          daysBetween: (new Date(sale.timestamp) - new Date(assetPurchases[0].timestamp)) / (24 * 60 * 60 * 1000),
          assetType: sale.platform,
          amount: sale.amount
        });
      }
    }

    return {
      totalEvents: panicSellingEvents,
      events: panicEvents,
      severity: panicSellingEvents === 0 ? 'none' : panicSellingEvents <= 2 ? 'low' : panicSellingEvents <= 5 ? 'medium' : 'high'
    };
  }

  /**
   * Analyze overall investment patterns
   */
  analyzeInvestmentPatterns(transactionHistory) {
    const purchases = transactionHistory.filter(tx => tx.type === 'purchase');
    
    if (purchases.length === 0) {
      return {
        pattern: 'no-investments',
        investmentStyle: 'none',
        regularity: 0,
        diversification: 0
      };
    }

    // Calculate investment amounts
    const amounts = purchases.map(tx => tx.amount);
    const avgInvestment = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    
    // Analyze investment size pattern
    const largeInvestments = amounts.filter(amount => amount > avgInvestment * 2).length;
    const smallInvestments = amounts.filter(amount => amount < avgInvestment * 0.5).length;
    
    let pattern = 'regular';
    if (largeInvestments > smallInvestments * 2) pattern = 'lump-sum';
    else if (smallInvestments > largeInvestments * 2) pattern = 'micro';
    
    // Calculate diversification
    const platforms = new Set(purchases.map(tx => tx.platform));
    const diversification = platforms.size / 4; // 4 is max (gold, silver, platinum, binr)

    // Calculate regularity
    const regularity = this.calculateInvestmentRegularity(purchases);

    return {
      pattern: pattern,
      investmentStyle: this.categorizeInvestmentStyle(avgInvestment, diversification),
      regularity: regularity,
      diversification: diversification,
      avgInvestment: avgInvestment,
      totalInvestments: purchases.length,
      totalAmount: amounts.reduce((sum, amount) => sum + amount, 0)
    };
  }

  /**
   * Calculate consistency score
   */
  calculateConsistencyScore(transactionHistory) {
    const purchases = transactionHistory.filter(tx => tx.type === 'purchase');
    
    if (purchases.length === 0) return 0;
    
    // Calculate time intervals between purchases
    const timeIntervals = [];
    for (let i = 1; i < purchases.length; i++) {
      const interval = new Date(purchases[i-1].timestamp) - new Date(purchases[i].timestamp);
      timeIntervals.push(interval);
    }
    
    if (timeIntervals.length === 0) return 0.5; // Only one purchase
    
    // Calculate standard deviation of intervals
    const avgInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length;
    const variance = timeIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Consistency is inverse of coefficient of variation
    const coefficientOfVariation = stdDev / avgInterval;
    const consistency = Math.max(0, 1 - coefficientOfVariation);
    
    return Math.min(1, consistency);
  }

  /**
   * Analyze risk tolerance
   */
  analyzeRiskTolerance(transactionHistory, portfolioData) {
    const purchases = transactionHistory.filter(tx => tx.type === 'purchase');
    
    if (purchases.length === 0) {
      return {
        level: 'unknown',
        score: 0,
        indicators: []
      };
    }

    const indicators = [];
    let riskScore = 0;

    // Check for high-value investments
    const highValueInvestments = purchases.filter(tx => tx.amount > 50000).length;
    if (highValueInvestments > 0) {
      indicators.push('high-value-investments');
      riskScore += 20;
    }

    // Check for diversified portfolio
    const platforms = new Set(purchases.map(tx => tx.platform));
    if (platforms.size >= 3) {
      indicators.push('diversified-portfolio');
      riskScore += 15;
    }

    // Check for volatile assets (platinum)
    const platinumInvestments = purchases.filter(tx => tx.platform === 'platinum').length;
    if (platinumInvestments > 0) {
      indicators.push('volatile-assets');
      riskScore += 25;
    }

    // Check for consistent large investments
    const largeInvestments = purchases.filter(tx => tx.amount > 10000).length;
    const largeInvestmentRatio = largeInvestments / purchases.length;
    if (largeInvestmentRatio > 0.5) {
      indicators.push('consistent-large-investments');
      riskScore += 20;
    }

    // Check for short-term trading
    const shortTermTransactions = this.identifyShortTermTrading(transactionHistory);
    if (shortTermTransactions > 3) {
      indicators.push('short-term-trading');
      riskScore += 30;
    }

    let level = 'conservative';
    if (riskScore >= 70) level = 'aggressive';
    else if (riskScore >= 50) level = 'moderate';
    else if (riskScore >= 30) level = 'balanced';

    return {
      level: level,
      score: Math.min(100, riskScore),
      indicators: indicators
    };
  }

  /**
   * Helper method to group transactions by date
   */
  groupTransactionsByDate(transactions) {
    const grouped = {};
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(tx);
    });
    return grouped;
  }

  /**
   * Helper method to group by month-year
   */
  groupByMonthYear(transactions) {
    const grouped = {};
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[monthYear]) grouped[monthYear] = [];
      grouped[monthYear].push(tx);
    });
    return grouped;
  }

  /**
   * Calculate SIP frequency
   */
  calculateSIPFrequency(transactionsByDate) {
    const dates = Object.keys(transactionsByDate).sort();
    if (dates.length < 2) return 'irregular';

    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      const days = (new Date(dates[i]) - new Date(dates[i-1])) / (24 * 60 * 60 * 1000);
      intervals.push(days);
    }

    const avgInterval = intervals.reduce((sum, days) => sum + days, 0) / intervals.length;

    if (avgInterval <= 3) return 'daily';
    if (avgInterval <= 10) return 'weekly';
    if (avgInterval <= 20) return 'bi-weekly';
    if (avgInterval <= 45) return 'monthly';
    return 'irregular';
  }

  /**
   * Calculate SIP consistency
   */
  calculateSIPConsistency(transactionsByDate, frequency) {
    const expectedIntervals = {
      'daily': 1,
      'weekly': 7,
      'bi-weekly': 14,
      'monthly': 30
    };

    const expectedInterval = expectedIntervals[frequency];
    if (!expectedInterval) return 0;

    const dates = Object.keys(transactionsByDate).sort();
    const intervals = [];
    
    for (let i = 1; i < dates.length; i++) {
      const days = (new Date(dates[i]) - new Date(dates[i-1])) / (24 * 60 * 60 * 1000);
      intervals.push(days);
    }

    if (intervals.length === 0) return 0;

    // Calculate how many intervals are within tolerance (±30%)
    const tolerance = expectedInterval * 0.3;
    const consistentIntervals = intervals.filter(interval => 
      Math.abs(interval - expectedInterval) <= tolerance
    );

    return consistentIntervals.length / intervals.length;
  }

  /**
   * Calculate current streak
   */
  calculateCurrentStreak(transactionsByDate) {
    const dates = Object.keys(transactionsByDate).sort().reverse(); // Most recent first
    if (dates.length === 0) return 0;

    let streak = 1;
    const now = new Date();
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i-1]);
      const currDate = new Date(dates[i]);
      const daysDiff = (prevDate - currDate) / (24 * 60 * 60 * 1000);
      
      // For daily/weekly SIP, check if within reasonable range
      if (daysDiff <= 8) { // Allow some flexibility
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  /**
   * Calculate current month streak
   */
  calculateCurrentMonthStreak(months) {
    if (months.length === 0) return 0;
    
    let streak = 1;
    const currentDate = new Date();
    
    // Start from previous month
    let checkYear = currentDate.getFullYear();
    let checkMonth = currentDate.getMonth();
    
    for (let i = months.length - 1; i >= 0; i--) {
      const [year, month] = months[i].split('-').map(Number);
      const expectedMonth = month === 1 ? 12 : month - 1;
      const expectedYear = month === 1 ? year - 1 : year;
      const expectedKey = `${expectedYear}-${String(expectedMonth).padStart(2, '0')}`;
      
      if (months.includes(expectedKey)) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  /**
   * Calculate longest streak
   */
  calculateLongestStreak(months) {
    if (months.length === 0) return 0;
    
    let longestStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < months.length; i++) {
      const [prevYear, prevMonth] = months[i-1].split('-').map(Number);
      const [currYear, currMonth] = months[i].split('-').map(Number);
      
      // Check if current month is consecutive to previous
      const expectedMonth = prevMonth === 12 ? 1 : prevMonth + 1;
      const expectedYear = prevMonth === 12 ? prevYear + 1 : prevYear;
      
      if (currMonth === expectedMonth && currYear === expectedYear) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    return longestStreak;
  }

  /**
   * Calculate time span in months
   */
  calculateTimeSpanInMonths(months) {
    if (months.length < 2) return 1;
    
    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    
    const [firstYear, firstMonthNum] = firstMonth.split('-').map(Number);
    const [lastYear, lastMonthNum] = lastMonth.split('-').map(Number);
    
    const firstDate = new Date(firstYear, firstMonthNum - 1);
    const lastDate = new Date(lastYear, lastMonthNum - 1);
    
    const diffTime = Math.abs(lastDate - firstDate);
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30);
    
    return Math.ceil(diffMonths);
  }

  /**
   * Calculate volatility
   */
  calculateVolatility(values) {
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  /**
   * Calculate holdings
   */
  calculateHoldings(transactions) {
    const purchaseDates = [];
    const sellDates = [];
    
    transactions.forEach(tx => {
      if (tx.type === 'purchase') {
        purchaseDates.push(new Date(tx.timestamp));
      } else if (tx.type === 'sale' || tx.type === 'withdrawal') {
        sellDates.push(new Date(tx.timestamp));
      }
    });
    
    if (purchaseDates.length === 0) {
      return { avgDays: 0, minDays: 0, maxDays: 0, longTermPercentage: 0 };
    }
    
    const holdingPeriods = [];
    purchaseDates.forEach(purchaseDate => {
      // For assets not sold, calculate days since purchase
      const daysHeld = (new Date() - purchaseDate) / (24 * 60 * 60 * 1000);
      holdingPeriods.push(daysHeld);
    });
    
    const avgDays = holdingPeriods.reduce((sum, days) => sum + days, 0) / holdingPeriods.length;
    const minDays = Math.min(...holdingPeriods);
    const maxDays = Math.max(...holdingPeriods);
    const longTermCount = holdingPeriods.filter(days => days >= 180).length;
    const longTermPercentage = (longTermCount / holdingPeriods.length) * 100;
    
    return {
      avgDays: Math.round(avgDays),
      minDays: Math.round(minDays),
      maxDays: Math.round(maxDays),
      longTermPercentage: Math.round(longTermPercentage)
    };
  }

  /**
   * Calculate investment regularity
   */
  calculateInvestmentRegularity(purchases) {
    if (purchases.length <= 1) return 0.5;
    
    const timeIntervals = [];
    for (let i = 1; i < purchases.length; i++) {
      const interval = new Date(purchases[i-1].timestamp) - new Date(purchases[i].timestamp);
      timeIntervals.push(interval / (24 * 60 * 60 * 1000)); // Convert to days
    }
    
    const mean = timeIntervals.reduce((sum, days) => sum + days, 0) / timeIntervals.length;
    const variance = timeIntervals.reduce((sum, days) => sum + Math.pow(days - mean, 2), 0) / timeIntervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Regularity is inverse of coefficient of variation
    return Math.max(0, 1 - (stdDev / mean));
  }

  /**
   * Categorize investment style
   */
  categorizeInvestmentStyle(avgInvestment, diversification) {
    if (diversification > 0.75) return 'well-diversified';
    if (avgInvestment < 1000) return 'micro-investor';
    if (avgInvestment > 25000) return 'large-investor';
    return 'regular-investor';
  }

  /**
   * Identify short-term trading
   */
  identifyShortTermTrading(transactionHistory) {
    let shortTermCount = 0;
    const transactionsByAsset = {};
    
    // Group by asset type
    transactionHistory.forEach(tx => {
      if (!transactionsByAsset[tx.platform]) {
        transactionsByAsset[tx.platform] = [];
      }
      transactionsByAsset[tx.platform].push(tx);
    });
    
    // Check for quick buy-sell cycles
    Object.values(transactionsByAsset).forEach(assetTransactions => {
      assetTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      for (let i = 0; i < assetTransactions.length - 1; i++) {
        const current = assetTransactions[i];
        const next = assetTransactions[i + 1];
        
        if ((current.type === 'purchase' && (next.type === 'sale' || next.type === 'withdrawal')) ||
            (current.type === 'sale' && next.type === 'purchase')) {
          
          const timeDiff = (new Date(next.timestamp) - new Date(current.timestamp)) / (24 * 60 * 60 * 1000);
          if (timeDiff <= 30) { // Within 30 days
            shortTermCount++;
          }
        }
      }
    });
    
    return shortTermCount;
  }

  /**
   * Calculate overall behavior score
   */
  calculateBehaviorScore(behavior) {
    let score = 0;
    
    // SIP behavior (40% weight)
    if (behavior.dailyWeeklySIP.active) {
      score += behavior.dailyWeeklySIP.consistency * 40;
    }
    
    // Monthly streak (20% weight)
    score += (behavior.monthlyStreak.currentStreak / 12) * 20;
    
    // Low volatility (15% weight)
    score += (1 - behavior.volatilityWithdrawals.volatility) * 15;
    
    // Long-term holding (15% weight)
    const avgHoldingDays = behavior.holdingDuration.averageDays;
    const longTermScore = Math.min(15, (avgHoldingDays / 365) * 15);
    score += longTermScore;
    
    // No panic selling (10% weight)
    if (behavior.panicSellingEvents.totalEvents === 0) {
      score += 10;
    } else {
      score += Math.max(0, 10 - (behavior.panicSellingEvents.totalEvents * 2));
    }
    
    return Math.min(100, score);
  }
}

module.exports = BehaviorEngine;