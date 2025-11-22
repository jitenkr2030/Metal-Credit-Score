/**
 * Metal Credit Score (MCS) - Core Scoring Engine
 * India's First Asset-Backed Credit Scoring Engine
 * 
 * @author MiniMax Agent
 * @version 1.0.0
 * @date 2025-11-21
 */

const Big = require('big.js');
const EventEmitter = require('events');

class ScoringEngine extends EventEmitter {
  constructor() {
    super();
    this.MIN_SCORE = 300;
    this.MAX_SCORE = 900;
    this.ASSET_WEIGHTS = {
      gold: 0.50,      // BGT - 50% weight
      silver: 0.20,    // BST - 20% weight  
      platinum: 0.10,  // BPT - 10% weight
      binr: 0.20       // BINR Stablecoin - 20% weight
    };
    
    this.ASSET_MAX_POINTS = {
      gold: 200,
      silver: 80,
      platinum: 40,
      binr: 80
    };

    this.BEHAVIOR_POINTS = {
      dailyWeeklySIP: 120,
      monthlyStreak: 60,
      lowVolatilityWithdrawals: 50,
      longTermHolding: 70,
      noPanicSelling: 50
    };

    this.RISK_PENALTIES = {
      largeWithdrawal: -60,
      fraudulentActivity: -100,
      multipleWallets: -20,
      noActivity: -20
    };

    // National income estimates for fallback
    this.NATIONAL_INCOME_ESTIMATES = {
      metro: 25000,    // ₹25,000/month metro cities
      urban: 18000,    // ₹18,000/month urban
      semiUrban: 12000, // ₹12,000/month semi-urban
      rural: 8000      // ₹8,000/month rural
    };
  }

  /**
   * Calculate Metal Credit Score (300-900)
   * @param {Object} userPortfolio - User's asset portfolio
   * @param {Object} userBehavior - User's transaction behavior
   * @param {Object} riskAnalysis - Risk assessment
   * @returns {Object} Complete MCS result
   */
  async calculateScore(userPortfolio, userBehavior, riskAnalysis) {
    try {
      // Step 1: Calculate Asset Score (Max 400 points)
      const assetScore = await this.calculateAssetScore(userPortfolio);
      
      // Step 2: Calculate Behavior Score (Max 300 points)
      const behaviorScore = await this.calculateBehaviorScore(userBehavior);
      
      // Step 3: Calculate Risk Score (Max 200 points)
      const riskScore = await this.calculateRiskScore(riskAnalysis);
      
      // Step 4: Calculate Final Score
      const finalScore = Math.max(
        this.MIN_SCORE,
        Math.min(this.MAX_SCORE, assetScore + behaviorScore + riskScore)
      );

      // Step 5: Determine Category and Recommendation
      const category = this.determineCategory(finalScore);
      const recommendation = this.generateLoanRecommendation(finalScore, userPortfolio);
      
      // Step 6: Generate Scoring Reasons
      const reasons = this.generateScoringReasons(assetScore, behaviorScore, riskScore);

      const result = {
        score: Math.round(finalScore),
        category: category,
        recommendation: recommendation,
        breakdown: {
          assetScore: Math.round(assetScore),
          behaviorScore: Math.round(behaviorScore),
          riskScore: Math.round(riskScore)
        },
        reasons: reasons,
        timestamp: new Date().toISOString(),
        validityDays: 30
      };

      // Emit scoring event
      this.emit('scoreCalculated', result);
      
      return result;
    } catch (error) {
      throw new Error(`Score calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate Asset Score (Max 400 points)
   * Based on user's metal holdings and stablecoin reserves
   */
  async calculateAssetScore(userPortfolio) {
    const { gold, silver, platinum, binr, userIncome } = userPortfolio;
    
    // Determine income estimate
    const incomeEstimate = userIncome || this.getNationalIncomeEstimate(userPortfolio.location);
    
    let totalAssetScore = 0;

    // Gold Score (BGT) - Max 200 points
    if (gold && gold.value > 0) {
      const goldRatio = new Big(gold.value).div(incomeEstimate);
      const goldScore = Math.min(
        this.ASSET_MAX_POINTS.gold,
        new Big(goldRatio).times(200).toNumber()
      );
      totalAssetScore += goldScore;
    }

    // Silver Score (BST) - Max 80 points
    if (silver && silver.value > 0) {
      const silverBenchmark = 5000; // ₹5,000 benchmark
      const silverRatio = new Big(silver.value).div(silverBenchmark);
      const silverScore = Math.min(
        this.ASSET_MAX_POINTS.silver,
        new Big(silverRatio).times(80).toNumber()
      );
      totalAssetScore += silverScore;
    }

    // Platinum Score (BPT) - Max 40 points
    if (platinum && platinum.value > 0) {
      const platinumBenchmark = 20000; // ₹20,000 benchmark
      const platinumRatio = new Big(platinum.value).div(platinumBenchmark);
      const platinumScore = Math.min(
        this.ASSET_MAX_POINTS.platinum,
        new Big(platinumRatio).times(40).toNumber()
      );
      totalAssetScore += platinumScore;
    }

    // BINR Stablecoin Score - Max 80 points
    if (binr && binr.balance > 0) {
      const binrBenchmark = incomeEstimate * 0.5; // 50% of monthly income
      const binrRatio = new Big(binr.balance).div(binrBenchmark);
      const binrScore = Math.min(
        this.ASSET_MAX_POINTS.binr,
        new Big(binrRatio).times(80).toNumber()
      );
      totalAssetScore += binrScore;
    }

    return Math.max(0, Math.min(400, totalAssetScore));
  }

  /**
   * Calculate Behavior Score (Max 300 points)
   * Based on user's investment patterns and holding behavior
   */
  async calculateBehaviorScore(userBehavior) {
    const { 
      dailyWeeklySIP, 
      monthlyStreak, 
      volatilityWithdrawals, 
      holdingDuration, 
      panicSellingEvents,
      transactionHistory 
    } = userBehavior;

    let totalBehaviorScore = 0;

    // Daily/Weekly SIP Score - Max 120 points
    if (dailyWeeklySIP && dailyWeeklySIP.active) {
      const sipConsistency = dailyWeeklySIP.consistency || 0.8;
      totalBehaviorScore += this.BEHAVIOR_POINTS.dailyWeeklySIP * sipConsistency;
    }

    // Monthly accumulation streak - Max 60 points
    if (monthlyStreak && monthlyStreak.months > 0) {
      const streakScore = Math.min(
        this.BEHAVIOR_POINTS.monthlyStreak,
        (monthlyStreak.months / 12) * this.BEHAVIOR_POINTS.monthlyStreak
      );
      totalBehaviorScore += streakScore;
    }

    // Low volatility withdrawals - Max 50 points
    if (volatilityWithdrawals) {
      const volatilityScore = Math.max(0, 
        this.BEHAVIOR_POINTS.lowVolatilityWithdrawals * (1 - volatilityWithdrawals)
      );
      totalBehaviorScore += volatilityScore;
    }

    // Long-term holding - Max 70 points
    if (holdingDuration && holdingDuration.averageDays > 0) {
      const holdingScore = Math.min(
        this.BEHAVIOR_POINTS.longTermHolding,
        (holdingDuration.averageDays / 365) * this.BEHAVIOR_POINTS.longTermHolding
      );
      totalBehaviorScore += holdingScore;
    }

    // No panic selling - Max 50 points
    if (panicSellingEvents === 0) {
      totalBehaviorScore += this.BEHAVIOR_POINTS.noPanicSelling;
    } else {
      // Penalize for panic selling
      const penalty = Math.min(
        panicSellingEvents * 10,
        this.BEHAVIOR_POINTS.noPanicSelling
      );
      totalBehaviorScore += (this.BEHAVIOR_POINTS.noPanicSelling - penalty);
    }

    return Math.max(0, Math.min(300, totalBehaviorScore));
  }

  /**
   * Calculate Risk Score (Max 200 points, negative penalties)
   */
  async calculateRiskScore(riskAnalysis) {
    const { 
      withdrawalPatterns, 
      fraudIndicators, 
      walletCount, 
      activityLevel,
      unusualTransactions 
    } = riskAnalysis;

    let totalRiskScore = 200; // Start with maximum score

    // Large sudden withdrawals penalty
    if (withdrawalPatterns && withdrawalPatterns.largeWithdrawals > 0) {
      const penaltyPerWithdrawal = 15;
      const totalPenalty = Math.min(
        withdrawalPatterns.largeWithdrawals * penaltyPerWithdrawal,
        Math.abs(this.RISK_PENALTIES.largeWithdrawal)
      );
      totalRiskScore += this.RISK_PENALTIES.largeWithdrawal * (totalPenalty / Math.abs(this.RISK_PENALTIES.largeWithdrawal));
    }

    // Fraudulent activity penalty
    if (fraudIndicators && fraudIndicators.suspiciousActivity > 0) {
      totalRiskScore += this.RISK_PENALTIES.fraudulentActivity;
    }

    // Multiple wallets penalty
    if (walletCount && walletCount.count > 3) {
      totalRiskScore += this.RISK_PENALTIES.multipleWallets;
    }

    // No activity penalty
    if (activityLevel && activityLevel.daysSinceLastActivity > 90) {
      totalRiskScore += this.RISK_PENALTIES.noActivity;
    }

    // Unusual transactions penalty
    if (unusualTransactions && unusualTransactions.count > 5) {
      const unusualPenalty = Math.min(unusualTransactions.count * 5, 30);
      totalRiskScore -= unusualPenalty;
    }

    return Math.max(0, Math.min(200, totalRiskScore));
  }

  /**
   * Determine credit category based on score
   */
  determineCategory(score) {
    if (score >= 800) return "Excellent";
    if (score >= 750) return "Very Good";
    if (score >= 700) return "Good";
    if (score >= 650) return "Average";
    if (score >= 600) return "Fair";
    if (score >= 550) return "Poor";
    return "Very Poor";
  }

  /**
   * Generate loan recommendation based on score and portfolio
   */
  generateLoanRecommendation(score, userPortfolio) {
    const totalAssets = (userPortfolio.gold?.value || 0) + 
                       (userPortfolio.silver?.value || 0) + 
                       (userPortfolio.platinum?.value || 0) + 
                       (userPortfolio.binr?.balance || 0);

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

    const assetBasedLoan = totalAssets * maxLoanPercentage;
    const recommendedAmount = Math.min(assetBasedLoan, baseAmount);

    return {
      maxAmount: Math.round(recommendedAmount),
      maxPercentage: (maxLoanPercentage * 100).toFixed(0) + '%',
      interestRate: this.calculateInterestRate(score),
      tenure: this.calculateTenure(score)
    };
  }

  /**
   * Calculate interest rate based on credit score
   */
  calculateInterestRate(score) {
    if (score >= 800) return "12-14%";
    if (score >= 750) return "14-16%";
    if (score >= 700) return "16-18%";
    if (score >= 650) return "18-20%";
    if (score >= 600) return "20-22%";
    if (score >= 550) return "22-24%";
    return "24-26%";
  }

  /**
   * Calculate recommended loan tenure
   */
  calculateTenure(score) {
    if (score >= 750) return "36 months";
    if (score >= 700) return "24 months";
    if (score >= 650) return "18 months";
    if (score >= 600) return "12 months";
    return "6 months";
  }

  /**
   * Generate detailed scoring reasons
   */
  generateScoringReasons(assetScore, behaviorScore, riskScore) {
    const reasons = [];

    if (assetScore >= 300) {
      reasons.push("Strong asset portfolio with diversified holdings");
    } else if (assetScore >= 200) {
      reasons.push("Good asset base with solid gold and stablecoin reserves");
    } else if (assetScore >= 100) {
      reasons.push("Moderate asset accumulation showing investment discipline");
    }

    if (behaviorScore >= 250) {
      reasons.push("Excellent investment behavior with consistent SIP contributions");
    } else if (behaviorScore >= 200) {
      reasons.push("Good investment habits with regular contributions");
    } else if (behaviorScore >= 150) {
      reasons.push("Stable investment pattern with low volatility");
    }

    if (riskScore >= 180) {
      reasons.push("Low risk profile with minimal suspicious activity");
    } else if (riskScore >= 150) {
      reasons.push("Moderate risk with standard transaction patterns");
    } else if (riskScore < 100) {
      reasons.push("Higher risk profile - requires additional monitoring");
    }

    return reasons;
  }

  /**
   * Get national income estimate based on location
   */
  getNationalIncomeEstimate(location) {
    if (!location) return this.NATIONAL_INCOME_ESTIMATES.urban;
    
    const locationType = location.toLowerCase();
    if (locationType.includes('metro') || locationType.includes('mumbai') || 
        locationType.includes('delhi') || locationType.includes('bangalore')) {
      return this.NATIONAL_INCOME_ESTIMATES.metro;
    } else if (locationType.includes('rural')) {
      return this.NATIONAL_INCOME_ESTIMATES.rural;
    } else if (locationType.includes('semi') || locationType.includes('tier 2')) {
      return this.NATIONAL_INCOME_ESTIMATES.semiUrban;
    } else {
      return this.NATIONAL_INCOME_ESTIMATES.urban;
    }
  }

  /**
   * Batch score calculation for multiple users
   */
  async batchCalculateScores(userDataArray) {
    const results = [];
    
    for (const userData of userDataArray) {
      try {
        const scoreResult = await this.calculateScore(
          userData.portfolio,
          userData.behavior,
          userData.risk
        );
        results.push({
          userId: userData.userId,
          ...scoreResult,
          success: true
        });
      } catch (error) {
        results.push({
          userId: userData.userId,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }
}

module.exports = ScoringEngine;