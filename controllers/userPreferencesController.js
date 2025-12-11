const UserPreferences = require('../models/UserPreferences');

/**
 * Get user preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    let preferences = await UserPreferences.findOne({ userId });

    // Create default if not exists
    if (!preferences) {
      preferences = new UserPreferences({ userId });
      await preferences.save();
    }

    res.status(200).json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
    });
  }
};

/**
 * Update trading preferences
 */
exports.updateTradingPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      preferredPairs,
      confluences,
      strategies,
      preferredSessions,
      maxRiskPerTrade,
      maxDailyDrawdown,
      defaultLotSize,
    } = req.body;

    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId });
    }

    // Update trading preferences
    if (preferredPairs !== undefined) {
      preferences.tradingPreferences.preferredPairs = preferredPairs;
    }
    if (confluences !== undefined) {
      preferences.tradingPreferences.confluences = confluences;
    }
    if (strategies !== undefined) {
      preferences.tradingPreferences.strategies = strategies;
    }
    if (preferredSessions !== undefined) {
      preferences.tradingPreferences.preferredSessions = preferredSessions;
    }
    if (maxRiskPerTrade !== undefined) {
      preferences.tradingPreferences.maxRiskPerTrade = maxRiskPerTrade;
    }
    if (maxDailyDrawdown !== undefined) {
      preferences.tradingPreferences.maxDailyDrawdown = maxDailyDrawdown;
    }
    if (defaultLotSize !== undefined) {
      preferences.tradingPreferences.defaultLotSize = defaultLotSize;
    }

    await preferences.save();

    res.status(200).json({
      success: true,
      message: 'Trading preferences updated',
      preferences,
    });
  } catch (error) {
    console.error('Update trading preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
    });
  }
};

/**
 * Get all confluences
 */
exports.getConfluences = async (req, res) => {
  try {
    const userId = req.user._id;

    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId });
      await preferences.save();
    }

    res.status(200).json({
      success: true,
      confluences: preferences.tradingPreferences.confluences || [],
    });
  } catch (error) {
    console.error('Get confluences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch confluences',
    });
  }
};

/**
 * Add a confluence
 */
exports.addConfluence = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, description, category } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Confluence name is required',
      });
    }

    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId });
    }

    // Check if confluence already exists
    const exists = preferences.tradingPreferences.confluences.some(
      conf => conf.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Confluence with this name already exists',
      });
    }

    preferences.tradingPreferences.confluences.push({
      name,
      description: description || '',
      category: category || 'technical',
    });

    await preferences.save();

    res.status(201).json({
      success: true,
      message: 'Confluence added successfully',
      preferences,
    });
  } catch (error) {
    console.error('Add confluence error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add confluence',
    });
  }
};

/**
 * Update a confluence
 */
exports.updateConfluence = async (req, res) => {
  try {
    const userId = req.user._id;
    const { confluenceId } = req.params;
    const { name, description, category } = req.body;

    const preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found',
      });
    }

    const confluence = preferences.tradingPreferences.confluences.find(
      conf => conf._id.toString() === confluenceId
    );

    if (!confluence) {
      return res.status(404).json({
        success: false,
        message: 'Confluence not found',
      });
    }

    // Check if new name already exists (excluding current confluence)
    if (name && name !== confluence.name) {
      const exists = preferences.tradingPreferences.confluences.some(
        conf => conf._id.toString() !== confluenceId && 
                conf.name.toLowerCase() === name.toLowerCase()
      );

      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Confluence with this name already exists',
        });
      }
    }

    // Update fields
    if (name !== undefined) confluence.name = name;
    if (description !== undefined) confluence.description = description;
    if (category !== undefined) confluence.category = category;

    await preferences.save();

    res.status(200).json({
      success: true,
      message: 'Confluence updated successfully',
      confluence,
      preferences,
    });
  } catch (error) {
    console.error('Update confluence error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update confluence',
    });
  }
};

/**
 * Remove a confluence
 */
exports.removeConfluence = async (req, res) => {
  try {
    const userId = req.user._id;
    const { confluenceId } = req.params;

    const preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found',
      });
    }

    preferences.tradingPreferences.confluences = 
      preferences.tradingPreferences.confluences.filter(
        conf => conf._id.toString() !== confluenceId
      );

    await preferences.save();

    res.status(200).json({
      success: true,
      message: 'Confluence removed successfully',
      preferences,
    });
  } catch (error) {
    console.error('Remove confluence error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove confluence',
    });
  }
};

/**
 * Add preferred pair
 */
exports.addPreferredPair = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pair } = req.body;

    if (!pair) {
      return res.status(400).json({
        success: false,
        message: 'Pair is required',
      });
    }

    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId });
    }

    if (preferences.tradingPreferences.preferredPairs.includes(pair)) {
      return res.status(400).json({
        success: false,
        message: 'Pair already in preferred list',
      });
    }

    preferences.tradingPreferences.preferredPairs.push(pair);
    await preferences.save();

    res.status(200).json({
      success: true,
      message: 'Preferred pair added',
      preferences,
    });
  } catch (error) {
    console.error('Add preferred pair error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add preferred pair',
    });
  }
};

/**
 * Remove preferred pair
 */
exports.removePreferredPair = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pair } = req.params;

    const preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found',
      });
    }

    preferences.tradingPreferences.preferredPairs = 
      preferences.tradingPreferences.preferredPairs.filter(p => p !== pair);

    await preferences.save();

    res.status(200).json({
      success: true,
      message: 'Preferred pair removed',
      preferences,
    });
  } catch (error) {
    console.error('Remove preferred pair error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove preferred pair',
    });
  }
};

/**
 * Update dashboard settings
 */
exports.updateDashboardSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      defaultTimeframe,
      primaryAccountId,
      showBalance,
      showEquity,
      showProfit,
      showWinRate,
      showROI,
    } = req.body;

    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId });
    }

    // Update dashboard settings
    if (defaultTimeframe !== undefined) {
      preferences.dashboardSettings.defaultTimeframe = defaultTimeframe;
    }
    if (primaryAccountId !== undefined) {
      preferences.dashboardSettings.primaryAccountId = primaryAccountId;
    }
    if (showBalance !== undefined) {
      preferences.dashboardSettings.showBalance = showBalance;
    }
    if (showEquity !== undefined) {
      preferences.dashboardSettings.showEquity = showEquity;
    }
    if (showProfit !== undefined) {
      preferences.dashboardSettings.showProfit = showProfit;
    }
    if (showWinRate !== undefined) {
      preferences.dashboardSettings.showWinRate = showWinRate;
    }
    if (showROI !== undefined) {
      preferences.dashboardSettings.showROI = showROI;
    }

    await preferences.save();

    res.status(200).json({
      success: true,
      message: 'Dashboard settings updated',
      preferences,
    });
  } catch (error) {
    console.error('Update dashboard settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dashboard settings',
    });
  }
};

/**
 * Update notification preferences
 */
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      emailOnTradeClose,
      emailOnDailyReport,
      emailOnWeeklyReport,
      pushOnTradeClose,
      pushOnAccountSync,
    } = req.body;

    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId });
    }

    // Update notification preferences
    if (emailOnTradeClose !== undefined) {
      preferences.notifications.emailOnTradeClose = emailOnTradeClose;
    }
    if (emailOnDailyReport !== undefined) {
      preferences.notifications.emailOnDailyReport = emailOnDailyReport;
    }
    if (emailOnWeeklyReport !== undefined) {
      preferences.notifications.emailOnWeeklyReport = emailOnWeeklyReport;
    }
    if (pushOnTradeClose !== undefined) {
      preferences.notifications.pushOnTradeClose = pushOnTradeClose;
    }
    if (pushOnAccountSync !== undefined) {
      preferences.notifications.pushOnAccountSync = pushOnAccountSync;
    }

    await preferences.save();

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated',
      preferences,
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
    });
  }
};
