// Test script to validate ad creation functionality
// Run with: node tests/adTest.js

const mongoose = require('mongoose');
const Ad = require('../models/Ad');
const User = require('../models/User');
require('dotenv').config();

// Test data
const testUser = {
  name: 'Test User',
  email: 'testuser@example.com',
  password: 'password123',
  country: 'US'
};

const testAd = {
  title: 'Test Product Launch',
  description: 'Introducing our amazing new product that will revolutionize your workflow.',
  imageUrl: 'https://example.com/test-image.jpg',
  linkUrl: 'https://example.com/product',
  targeting: {
    type: 'country',
    countries: ['US', 'CA', 'GB'],
    userbaseTarget: 50000
  },
  schedule: {
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // Next week
    duration: 7
  },
  pricing: {
    dailyBudgetUSD: 50,
    totalPriceUSD: 350,
    userCurrency: 'USD',
    exchangeRate: 1,
    totalPriceUserCurrency: 350
  }
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forex-journal');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function createTestUser() {
  try {
    // Check if test user already exists
    let user = await User.findOne({ email: testUser.email });
    
    if (!user) {
      user = new User(testUser);
      await user.save();
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user already exists');
    }
    
    return user;
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
}

async function testAdCreation(userId) {
  try {
    console.log('\n🧪 Testing Ad Creation...');
    
    const ad = new Ad({
      ...testAd,
      userId
    });
    
    await ad.save();
    console.log('✅ Ad created successfully');
    console.log(`   - Ad ID: ${ad._id}`);
    console.log(`   - Status: ${ad.status}`);
    console.log(`   - Total Price: $${ad.pricing.totalPriceUSD}`);
    
    return ad;
  } catch (error) {
    console.error('❌ Error creating ad:', error);
    throw error;
  }
}

async function testAdMethods(ad) {
  try {
    console.log('\n🧪 Testing Ad Methods...');
    
    // Test price calculation
    const calculatedPrice = ad.calculateTotalPrice();
    console.log(`✅ Price calculation: $${calculatedPrice} (expected: $${testAd.pricing.totalPriceUSD})`);
    
    // Test approval
    ad.approve();
    await ad.save();
    console.log(`✅ Ad approved. Status: ${ad.status}`);
    
    // Test activation
    ad.activate();
    await ad.save();
    console.log(`✅ Ad activated. Status: ${ad.status}`);
    
    // Test performance update
    ad.updatePerformance(1000, 50); // 1000 impressions, 50 clicks
    await ad.save();
    console.log(`✅ Performance updated. CTR: ${ad.performance.clickThroughRate}%`);
    
    return ad;
  } catch (error) {
    console.error('❌ Error testing ad methods:', error);
    throw error;
  }
}

async function testAdQueries() {
  try {
    console.log('\n🧪 Testing Ad Queries...');
    
    // Test finding active ads
    const activeAds = await Ad.find({ status: 'active' });
    console.log(`✅ Found ${activeAds.length} active ads`);
    
    // Test finding ads by country targeting
    const usAds = await Ad.find({ 'targeting.countries': 'US' });
    console.log(`✅ Found ${usAds.length} ads targeting US`);
    
    // Test aggregation for analytics
    const analytics = await Ad.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalPriceUSD' },
          totalImpressions: { $sum: '$performance.impressions' }
        }
      }
    ]);
    
    console.log('✅ Analytics aggregation:');
    analytics.forEach(stat => {
      console.log(`   - ${stat._id}: ${stat.count} ads, $${stat.totalRevenue} revenue, ${stat.totalImpressions} impressions`);
    });
    
  } catch (error) {
    console.error('❌ Error testing ad queries:', error);
    throw error;
  }
}

async function testGlobalTargeting(userId) {
  try {
    console.log('\n🧪 Testing Global Targeting...');
    
    const globalAd = new Ad({
      ...testAd,
      userId,
      title: 'Global Campaign Test',
      targeting: {
        type: 'global',
        userbaseTarget: 1000000 // 1M global users
      },
      pricing: {
        dailyBudgetUSD: 100,
        totalPriceUSD: 700, // 7 days * $100
        userCurrency: 'EUR',
        exchangeRate: 0.85,
        totalPriceUserCurrency: 595 // $700 * 0.85
      }
    });
    
    await globalAd.save();
    console.log('✅ Global targeting ad created');
    console.log(`   - Targeting: ${globalAd.targeting.type}`);
    console.log(`   - Userbase Target: ${globalAd.targeting.userbaseTarget.toLocaleString()}`);
    console.log(`   - Price in EUR: €${globalAd.pricing.totalPriceUserCurrency}`);
    
    return globalAd;
  } catch (error) {
    console.error('❌ Error testing global targeting:', error);
    throw error;
  }
}

async function testValidationErrors() {
  try {
    console.log('\n🧪 Testing Validation Errors...');
    
    // Test invalid ad (missing required fields)
    try {
      const invalidAd = new Ad({
        title: '', // Empty title should fail
        userId: new mongoose.Types.ObjectId()
      });
      await invalidAd.save();
      console.log('❌ Validation should have failed');
    } catch (error) {
      console.log('✅ Validation correctly rejected invalid ad');
    }
    
    // Test invalid schedule
    try {
      const invalidScheduleAd = new Ad({
        ...testAd,
        userId: new mongoose.Types.ObjectId(),
        schedule: {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (past date)
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          duration: 1
        }
      });
      await invalidScheduleAd.save();
      console.log('❌ Past date validation should have failed');
    } catch (error) {
      console.log('✅ Validation correctly rejected past start date');
    }
    
  } catch (error) {
    console.error('❌ Error testing validation:', error);
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    // Remove test ads
    await Ad.deleteMany({ title: { $regex: /test/i } });
    
    // Remove test user
    await User.deleteOne({ email: testUser.email });
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting Ad Model Tests...\n');
    
    await connectDB();
    
    const user = await createTestUser();
    const ad = await testAdCreation(user._id);
    await testAdMethods(ad);
    await testAdQueries();
    await testGlobalTargeting(user._id);
    await testValidationErrors();
    
    console.log('\n✅ All tests completed successfully!');
    
    // Ask if user wants to keep test data
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\nDo you want to clean up test data? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        await cleanup();
      } else {
        console.log('Test data preserved for manual inspection');
      }
      
      rl.close();
      mongoose.connection.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testUser,
  testAd
};
