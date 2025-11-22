/**
 * Portfolio Fetcher Service
 * Fetches user portfolio data from all asset platforms (BGT, BST, BPT, BINR)
 * 
 * @author MiniMax Agent
 * @version 1.0.0
 * @date 2025-11-21
 */

const axios = require('axios');
const EventEmitter = require('events');

class PortfolioFetcher extends EventEmitter {
  constructor() {
    super();
    this.ASSET_PLATFORMS = {
      bgt: {
        baseUrl: process.env.BGT_API_URL || 'http://localhost:3001/api',
        tokenSymbol: 'BGT',
        name: 'Bharat Gold Token'
      },
      bst: {
        baseUrl: process.env.BST_API_URL || 'http://localhost:3002/api',
        tokenSymbol: 'BST',
        name: 'Bharat Silver Token'
      },
      bpt: {
        baseUrl: process.env.BPT_API_URL || 'http://localhost:3003/api',
        tokenSymbol: 'BPT',
        name: 'Bharat Platinum Token'
      },
      binr: {
        baseUrl: process.env.BINR_API_URL || 'http://localhost:3004/api',
        tokenSymbol: 'BINR',
        name: 'BINR Stablecoin'
      }
    };
    
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    this.portfolioCache = new Map();
  }

  /**
   * Fetch complete portfolio for a user
   * @param {string} userId - User identifier
   * @param {Object} userAddress - User's wallet addresses for each platform
   * @returns {Object} Complete portfolio data
   */
  async fetchCompletePortfolio(userId, userAddress) {
    try {
      const cacheKey = `${userId}_${JSON.stringify(userAddress)}`;
      const cached = this.getCachedPortfolio(cacheKey);
      
      if (cached) {
        return cached;
      }

      const portfolio = {
        userId: userId,
        timestamp: new Date().toISOString(),
        gold: null,
        silver: null,
        platinum: null,
        binr: null,
        transactionHistory: [],
        lastUpdated: new Date().toISOString()
      };

      // Fetch from all platforms concurrently
      const platformPromises = [
        this.fetchGoldPortfolio(userId, userAddress.gold),
        this.fetchSilverPortfolio(userId, userAddress.silver),
        this.fetchPlatinumPortfolio(userId, userAddress.platinum),
        this.fetchBINRPortfolio(userId, userAddress.binr)
      ];

      const results = await Promise.allSettled(platformPromises);
      
      // Process gold data
      if (results[0].status === 'fulfilled') {
        portfolio.gold = results[0].value;
      }

      // Process silver data
      if (results[1].status === 'fulfilled') {
        portfolio.silver = results[1].value;
      }

      // Process platinum data
      if (results[2].status === 'fulfilled') {
        portfolio.platinum = results[2].value;
      }

      // Process BINR data
      if (results[3].status === 'fulfilled') {
        portfolio.binr = results[3].value;
      }

      // Fetch consolidated transaction history
      portfolio.transactionHistory = await this.fetchTransactionHistory(userId, userAddress);

      // Calculate portfolio metrics
      portfolio.metrics = this.calculatePortfolioMetrics(portfolio);

      // Cache the result
      this.cachePortfolio(cacheKey, portfolio);

      // Emit portfolio fetched event
      this.emit('portfolioFetched', { userId, portfolio });

      return portfolio;
    } catch (error) {
      throw new Error(`Portfolio fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch gold portfolio (BGT)
   */
  async fetchGoldPortfolio(userId, goldAddress) {
    if (!goldAddress) return null;

    try {
      const response = await axios.get(`${this.ASSET_PLATFORMS.bgt.baseUrl}/portfolio/${goldAddress}`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${process.env.BGT_API_TOKEN}` }
      });

      const data = response.data;
      
      return {
        tokenSymbol: 'BGT',
        name: this.ASSET_PLATFORMS.bgt.name,
        address: goldAddress,
        balance: data.balance || 0,
        tokens: data.tokens || 0,
        value: data.inrValue || 0,
        lastPurchase: data.lastPurchaseDate || null,
        totalPurchases: data.totalPurchases || 0,
        avgPurchasePrice: data.avgPurchasePrice || 0,
        currentPrice: data.currentPrice || 0,
        profitLoss: data.profitLoss || 0,
        profitLossPercentage: data.profitLossPercentage || 0,
        sipActive: data.sipActive || false,
        sipAmount: data.sipAmount || 0,
        sipFrequency: data.sipFrequency || null,
        vaultStored: data.vaultStored || false,
        stakingRewards: data.stakingRewards || 0
      };
    } catch (error) {
      console.error(`Failed to fetch gold portfolio for ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch silver portfolio (BST)
   */
  async fetchSilverPortfolio(userId, silverAddress) {
    if (!silverAddress) return null;

    try {
      const response = await axios.get(`${this.ASSET_PLATFORMS.bst.baseUrl}/portfolio/${silverAddress}`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${process.env.BST_API_TOKEN}` }
      });

      const data = response.data;
      
      return {
        tokenSymbol: 'BST',
        name: this.ASSET_PLATFORMS.bst.name,
        address: silverAddress,
        balance: data.balance || 0,
        tokens: data.tokens || 0,
        value: data.inrValue || 0,
        lastPurchase: data.lastPurchaseDate || null,
        totalPurchases: data.totalPurchases || 0,
        avgPurchasePrice: data.avgPurchasePrice || 0,
        currentPrice: data.currentPrice || 0,
        profitLoss: data.profitLoss || 0,
        profitLossPercentage: data.profitLossPercentage || 0,
        sipActive: data.sipActive || false,
        sipAmount: data.sipAmount || 0,
        sipFrequency: data.sipFrequency || null,
        vaultStored: data.vaultStored || false,
        stakingRewards: data.stakingRewards || 0
      };
    } catch (error) {
      console.error(`Failed to fetch silver portfolio for ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch platinum portfolio (BPT)
   */
  async fetchPlatinumPortfolio(userId, platinumAddress) {
    if (!platinumAddress) return null;

    try {
      const response = await axios.get(`${this.ASSET_PLATFORMS.bpt.baseUrl}/portfolio/${platinumAddress}`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${process.env.BPT_API_TOKEN}` }
      });

      const data = response.data;
      
      return {
        tokenSymbol: 'BPT',
        name: this.ASSET_PLATFORMS.bpt.name,
        address: platinumAddress,
        balance: data.balance || 0,
        tokens: data.tokens || 0,
        value: data.inrValue || 0,
        lastPurchase: data.lastPurchaseDate || null,
        totalPurchases: data.totalPurchases || 0,
        avgPurchasePrice: data.avgPurchasePrice || 0,
        currentPrice: data.currentPrice || 0,
        profitLoss: data.profitLoss || 0,
        profitLossPercentage: data.profitLossPercentage || 0,
        sipActive: data.sipActive || false,
        sipAmount: data.sipAmount || 0,
        sipFrequency: data.sipFrequency || null,
        vaultStored: data.vaultStored || false,
        stakingRewards: data.stakingRewards || 0
      };
    } catch (error) {
      console.error(`Failed to fetch platinum portfolio for ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch BINR stablecoin portfolio
   */
  async fetchBINRPortfolio(userId, binrAddress) {
    if (!binrAddress) return null;

    try {
      const response = await axios.get(`${this.ASSET_PLATFORMS.binr.baseUrl}/portfolio/${binrAddress}`, {
        timeout: 10000,
        headers: { 'Authorization': `Bearer ${process.env.BINR_API_TOKEN}` }
      });

      const data = response.data;
      
      return {
        tokenSymbol: 'BINR',
        name: this.ASSET_PLATFORMS.binr.name,
        address: binrAddress,
        balance: data.balance || 0,
        totalDeposits: data.totalDeposits || 0,
        totalWithdrawals: data.totalWithdrawals || 0,
        avgBalance: data.avgBalance || 0,
        lastTransaction: data.lastTransactionDate || null,
        transactionCount: data.transactionCount || 0,
        interestEarned: data.interestEarned || 0,
        yieldPercentage: data.yieldPercentage || 0,
        walletType: data.walletType || 'standard'
      };
    } catch (error) {
      console.error(`Failed to fetch BINR portfolio for ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch transaction history from all platforms
   */
  async fetchTransactionHistory(userId, userAddress) {
    const allTransactions = [];
    const platforms = ['gold', 'silver', 'platinum', 'binr'];
    
    for (const platform of platforms) {
      const address = userAddress[platform];
      if (!address) continue;

      try {
        const response = await axios.get(
          `${this.ASSET_PLATFORMS[platform].baseUrl}/transactions/${address}?limit=100`, 
          {
            timeout: 10000,
            headers: { 'Authorization': `Bearer ${process.env[`${platform.toUpperCase()}_API_TOKEN`]}` }
          }
        );

        if (response.data && Array.isArray(response.data)) {
          const transactions = response.data.map(tx => ({
            ...tx,
            platform: platform,
            tokenSymbol: this.ASSET_PLATFORMS[platform].tokenSymbol,
            platformName: this.ASSET_PLATFORMS[platform].name
          }));
          allTransactions.push(...transactions);
        }
      } catch (error) {
        console.error(`Failed to fetch ${platform} transactions for ${userId}:`, error.message);
      }
    }

    // Sort by timestamp descending
    return allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Calculate portfolio metrics
   */
  calculatePortfolioMetrics(portfolio) {
    const totalValue = (portfolio.gold?.value || 0) + 
                      (portfolio.silver?.value || 0) + 
                      (portfolio.platinum?.value || 0) + 
                      (portfolio.binr?.balance || 0);

    const assetAllocation = {
      gold: portfolio.gold?.value || 0,
      silver: portfolio.silver?.value || 0,
      platinum: portfolio.platinum?.value || 0,
      binr: portfolio.binr?.balance || 0
    };

    // Calculate percentages
    if (totalValue > 0) {
      assetAllocation.gold = (assetAllocation.gold / totalValue * 100).toFixed(2);
      assetAllocation.silver = (assetAllocation.silver / totalValue * 100).toFixed(2);
      assetAllocation.platinum = (assetAllocation.platinum / totalValue * 100).toFixed(2);
      assetAllocation.binr = (assetAllocation.binr / totalValue * 100).toFixed(2);
    }

    return {
      totalValue: totalValue,
      totalTokens: (portfolio.gold?.tokens || 0) + 
                  (portfolio.silver?.tokens || 0) + 
                  (portfolio.platinum?.tokens || 0),
      assetAllocation: assetAllocation,
      diversificationScore: this.calculateDiversificationScore(assetAllocation),
      riskLevel: this.calculateRiskLevel(portfolio),
      lastActivity: this.getLastActivityDate(portfolio)
    };
  }

  /**
   * Calculate diversification score
   */
  calculateDiversificationScore(allocation) {
    const weights = [
      parseFloat(allocation.gold || 0),
      parseFloat(allocation.silver || 0),
      parseFloat(allocation.platinum || 0),
      parseFloat(allocation.binr || 0)
    ].filter(w => w > 0);

    if (weights.length === 0) return 0;
    if (weights.length === 1) return 50;

    // Calculate Herfindahl-Hirschman Index
    const hhi = weights.reduce((sum, weight) => sum + Math.pow(weight / 100, 2), 0);
    const normalizedDiversification = (1 - hhi) * 100;
    
    return Math.round(normalizedDiversification);
  }

  /**
   * Calculate risk level based on allocation
   */
  calculateRiskLevel(portfolio) {
    const goldValue = portfolio.gold?.value || 0;
    const binrValue = portfolio.binr?.balance || 0;
    const silverValue = portfolio.silver?.value || 0;
    const platinumValue = portfolio.platinum?.value || 0;
    const totalValue = goldValue + binrValue + silverValue + platinumValue;

    if (totalValue === 0) return 'No Assets';

    const goldPercentage = goldValue / totalValue;
    const binrPercentage = binrValue / totalValue;
    const preciousMetalPercentage = (goldValue + silverValue + platinumValue) / totalValue;

    if (binrPercentage >= 0.5) return 'Low';
    if (goldPercentage >= 0.6) return 'Low';
    if (preciousMetalPercentage >= 0.8) return 'Medium';
    return 'High';
  }

  /**
   * Get last activity date across all assets
   */
  getLastActivityDate(portfolio) {
    const dates = [];
    
    if (portfolio.gold?.lastPurchase) dates.push(new Date(portfolio.gold.lastPurchase));
    if (portfolio.silver?.lastPurchase) dates.push(new Date(portfolio.silver.lastPurchase));
    if (portfolio.platinum?.lastPurchase) dates.push(new Date(portfolio.platinum.lastPurchase));
    if (portfolio.binr?.lastTransaction) dates.push(new Date(portfolio.binr.lastTransaction));

    if (dates.length === 0) return null;
    return new Date(Math.max(...dates)).toISOString();
  }

  /**
   * Cache portfolio data
   */
  cachePortfolio(key, portfolio) {
    this.portfolioCache.set(key, {
      data: portfolio,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached portfolio if valid
   */
  getCachedPortfolio(key) {
    const cached = this.portfolioCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.portfolioCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Clear cache for a specific user
   */
  clearUserCache(userId) {
    const keysToDelete = [];
    for (const key of this.portfolioCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.portfolioCache.delete(key));
  }

  /**
   * Get platform status
   */
  async getPlatformStatus() {
    const status = {};
    
    for (const [platform, config] of Object.entries(this.ASSET_PLATFORMS)) {
      try {
        const response = await axios.get(`${config.baseUrl}/health`, {
          timeout: 5000
        });
        status[platform] = {
          online: true,
          responseTime: response.headers['x-response-time'] || 'N/A',
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        status[platform] = {
          online: false,
          error: error.message,
          lastCheck: new Date().toISOString()
        };
      }
    }
    
    return status;
  }
}

module.exports = PortfolioFetcher;