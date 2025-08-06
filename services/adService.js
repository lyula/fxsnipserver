const Ad = require('../models/Ad');
const cron = require('node-cron');

// Service to handle ad lifecycle management
class AdService {
  
  // Check and update expired ads
  static async checkExpiredAds() {
    try {
      const now = new Date();
      
      // Find ads that should be completed
      const expiredAds = await Ad.find({
        status: 'active',
        'schedule.endDate': { $lte: now }
      });

      for (const ad of expiredAds) {
        ad.status = 'completed';
        await ad.save();
        console.log(`Ad ${ad._id} marked as completed`);
      }

      console.log(`Checked ${expiredAds.length} expired ads`);
      return expiredAds.length;
      
    } catch (error) {
      console.error('Error checking expired ads:', error);
      throw error;
    }
  }

  // Activate ads that are scheduled to start
  static async activateScheduledAds() {
    try {
      const now = new Date();
      
      // Find ads that should be activated
      const adsToActivate = await Ad.find({
        status: 'pending_payment',
        isApproved: true,
        'paymentInfo.paymentStatus': 'completed',
        'schedule.startDate': { $lte: now }
      });

      for (const ad of adsToActivate) {
        ad.activate();
        await ad.save();
        console.log(`Ad ${ad._id} activated`);
      }

      console.log(`Activated ${adsToActivate.length} scheduled ads`);
      return adsToActivate.length;
      
    } catch (error) {
      console.error('Error activating scheduled ads:', error);
      throw error;
    }
  }

  // Send reminders for ads pending payment
  static async sendPaymentReminders() {
    try {
      const reminderDate = new Date();
      reminderDate.setHours(reminderDate.getHours() - 24); // 24 hours ago

      const pendingAds = await Ad.find({
        status: 'pending_payment',
        createdAt: { $lte: reminderDate },
        'paymentInfo.paymentStatus': { $ne: 'completed' }
      }).populate('userId', 'name email');

      for (const ad of pendingAds) {
        // In a real implementation, you would send email or notification here
        console.log(`Payment reminder needed for ad ${ad._id} (user: ${ad.userId.email})`);
      }

      console.log(`Found ${pendingAds.length} ads needing payment reminders`);
      return pendingAds.length;
      
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      throw error;
    }
  }

  // Clean up old draft ads
  static async cleanupOldDrafts() {
    try {
      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - 30); // 30 days ago

      const result = await Ad.deleteMany({
        status: 'draft',
        createdAt: { $lte: cleanupDate }
      });

      console.log(`Cleaned up ${result.deletedCount} old draft ads`);
      return result.deletedCount;
      
    } catch (error) {
      console.error('Error cleaning up old drafts:', error);
      throw error;
    }
  }

  // Generate daily ad performance report
  static async generateDailyReport() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
      const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

      const dailyStats = await Ad.aggregate([
        {
          $match: {
            status: { $in: ['active', 'completed'] },
            'schedule.startDate': { $lte: endOfDay },
            'schedule.endDate': { $gte: startOfDay }
          }
        },
        {
          $group: {
            _id: null,
            totalAds: { $sum: 1 },
            totalImpressions: { $sum: '$performance.impressions' },
            totalClicks: { $sum: '$performance.clicks' },
            totalRevenue: { $sum: '$pricing.totalPriceUSD' },
            avgCTR: { $avg: '$performance.clickThroughRate' }
          }
        }
      ]);

      const report = dailyStats[0] || {
        totalAds: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalRevenue: 0,
        avgCTR: 0
      };

      console.log(`Daily Report (${yesterday.toDateString()}):`, report);
      
      // In a real implementation, you might save this to a reports collection
      // or send it via email to administrators
      
      return report;
      
    } catch (error) {
      console.error('Error generating daily report:', error);
      throw error;
    }
  }

  // Initialize all scheduled tasks
  static initializeScheduledTasks() {
    console.log('Initializing ad management scheduled tasks...');

    // Check for expired ads every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.checkExpiredAds();
        await this.activateScheduledAds();
      } catch (error) {
        console.error('Error in hourly ad check:', error);
      }
    });

    // Send payment reminders twice daily (9 AM and 6 PM)
    cron.schedule('0 9,18 * * *', async () => {
      try {
        await this.sendPaymentReminders();
      } catch (error) {
        console.error('Error sending payment reminders:', error);
      }
    });

    // Clean up old drafts weekly (Sunday at 2 AM)
    cron.schedule('0 2 * * 0', async () => {
      try {
        await this.cleanupOldDrafts();
      } catch (error) {
        console.error('Error cleaning up old drafts:', error);
      }
    });

    // Generate daily report at 1 AM
    cron.schedule('0 1 * * *', async () => {
      try {
        await this.generateDailyReport();
      } catch (error) {
        console.error('Error generating daily report:', error);
      }
    });

    console.log('Ad management scheduled tasks initialized successfully');
  }
}

module.exports = AdService;
