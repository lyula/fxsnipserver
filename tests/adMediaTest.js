// Test script for ad media functionality
// Run with: node tests/adMediaTest.js

const mongoose = require('mongoose');
const Ad = require('../models/Ad');
const User = require('../models/User');
require('dotenv').config();

// Test data with media
const testUser = {
  username: 'testaduser',
  name: 'Test User',
  email: 'testaduser@example.com',
  password: 'password123',
  country: 'US'
};

const testAdWithImage = {
  title: 'Image Ad Test',
  description: 'Testing ad creation with image media content for verification.',
  category: 'Technology',
  image: 'https://example.com/test-image.jpg',
  imagePublicId: 'test-image-public-id',
  linkUrl: 'https://example.com/product',
  targetingType: 'specific',
  targetCountries: [
    { name: 'United States', code: 'US', tier: 1 },
    { name: 'Canada', code: 'CA', tier: 1 }
  ],
  duration: 5,
  targetUserbase: {
    size: '50000',
    label: '50,000 - 200,000 users (Large audience)',
    multiplier: 1.8
  },
  pricing: {
    basePriceUSD: 10,
    totalPriceUSD: 90,
    userCurrency: {
      code: 'USD',
      symbol: '$',
      rate: 1,
      convertedPrice: 90
    }
  }
};

const testAdWithVideo = {
  title: 'Video Ad Test',
  description: 'Testing ad creation with video media content for verification.',
  category: 'Finance',
  video: 'https://example.com/test-video.mp4',
  videoPublicId: 'test-video-public-id',
  linkUrl: 'https://example.com/trading-platform',
  targetingType: 'global',
  duration: 7,
  targetUserbase: {
    size: '1000000',
    label: '1M+ users (Maximum reach)',
    multiplier: 3.2
  },
  pricing: {
    basePriceUSD: 3.5,
    totalPriceUSD: 78.4,
    userCurrency: {
      code: 'EUR',
      symbol: '€',
      rate: 0.92,
      convertedPrice: 72.13
    }
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

async function testImageAd(userId) {
  try {
    console.log('\n🧪 Testing Image Ad Creation...');
    
    const ad = new Ad({
      ...testAdWithImage,
      userId
    });
    
    await ad.save();
    console.log('✅ Image ad created successfully');
    console.log(`   - Ad ID: ${ad._id}`);
    console.log(`   - Image URL: ${ad.image}`);
    console.log(`   - Image Public ID: ${ad.imagePublicId}`);
    console.log(`   - Link URL: ${ad.linkUrl}`);
    console.log(`   - Status: ${ad.status}`);
    
    return ad;
  } catch (error) {
    console.error('❌ Error creating image ad:', error);
    throw error;
  }
}

async function testVideoAd(userId) {
  try {
    console.log('\n🧪 Testing Video Ad Creation...');
    
    const ad = new Ad({
      ...testAdWithVideo,
      userId
    });
    
    await ad.save();
    console.log('✅ Video ad created successfully');
    console.log(`   - Ad ID: ${ad._id}`);
    console.log(`   - Video URL: ${ad.video}`);
    console.log(`   - Video Public ID: ${ad.videoPublicId}`);
    console.log(`   - Link URL: ${ad.linkUrl}`);
    console.log(`   - Status: ${ad.status}`);
    
    return ad;
  } catch (error) {
    console.error('❌ Error creating video ad:', error);
    throw error;
  }
}

async function testAdWithBothMedia(userId) {
  try {
    console.log('\n🧪 Testing Ad with Both Image and Video...');
    
    const ad = new Ad({
      title: 'Mixed Media Ad',
      description: 'This ad has both image and video - should be valid.',
      category: 'Education',
      image: 'https://example.com/image.jpg',
      imagePublicId: 'image-id',
      video: 'https://example.com/video.mp4',
      videoPublicId: 'video-id',
      linkUrl: 'https://example.com/learn',
      targetingType: 'global',
      duration: 3,
      targetUserbase: {
        size: '10000',
        label: 'Medium audience',
        multiplier: 1.3
      },
      pricing: {
        basePriceUSD: 2.0,
        totalPriceUSD: 7.8,
        userCurrency: {
          code: 'USD',
          symbol: '$',
          rate: 1.0,
          convertedPrice: 7.8
        }
      },
      userId
    });
    
    await ad.save();
    console.log('✅ Mixed media ad created successfully');
    console.log(`   - Has both image and video: ${!!ad.image && !!ad.video}`);
    
    return ad;
  } catch (error) {
    console.error('❌ Error creating mixed media ad:', error);
    throw error;
  }
}

async function testValidationErrors() {
  try {
    console.log('\n🧪 Testing Validation Errors...');
    
    // Test ad without any media
    try {
      const adWithoutMedia = new Ad({
        title: 'No Media Ad',
        description: 'This ad has no image or video - should fail.',
        category: 'Technology',
        linkUrl: 'https://example.com',
        targetingType: 'global',
        duration: 1,
        targetUserbase: {
          size: '1000',
          label: 'Small',
          multiplier: 1
        },
        userId: new mongoose.Types.ObjectId()
      });
      
      await adWithoutMedia.save();
      console.log('❌ Validation should have failed for ad without media');
    } catch (error) {
      console.log('✅ Validation correctly rejected ad without media');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test ad without link URL
    try {
      const adWithoutLink = new Ad({
        title: 'No Link Ad',
        description: 'This ad has no link URL - should fail.',
        category: 'Technology',
        image: 'https://example.com/image.jpg',
        targetingType: 'global',
        duration: 1,
        targetUserbase: {
          size: '1000',
          label: 'Small',
          multiplier: 1
        },
        userId: new mongoose.Types.ObjectId()
      });
      
      await adWithoutLink.save();
      console.log('❌ Validation should have failed for ad without link URL');
    } catch (error) {
      console.log('✅ Validation correctly rejected ad without link URL');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test ad with invalid URL
    try {
      const adWithInvalidUrl = new Ad({
        title: 'Invalid URL Ad',
        description: 'This ad has invalid URL - should fail.',
        category: 'Technology',
        image: 'https://example.com/image.jpg',
        linkUrl: 'not-a-valid-url',
        targetingType: 'global',
        duration: 1,
        targetUserbase: {
          size: '1000',
          label: 'Small',
          multiplier: 1
        },
        userId: new mongoose.Types.ObjectId()
      });
      
      await adWithInvalidUrl.save();
      console.log('❌ Validation should have failed for ad with invalid URL');
    } catch (error) {
      console.log('✅ Validation correctly rejected ad with invalid URL');
      console.log(`   Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing validation:', error);
  }
}

async function testAdQueries() {
  try {
    console.log('\n🧪 Testing Ad Queries...');
    
    // Find ads with images
    const imageAds = await Ad.find({ image: { $exists: true, $ne: null } });
    console.log(`✅ Found ${imageAds.length} ads with images`);
    
    // Find ads with videos
    const videoAds = await Ad.find({ video: { $exists: true, $ne: null } });
    console.log(`✅ Found ${videoAds.length} ads with videos`);
    
    // Find ads by category with media
    const techAdsWithMedia = await Ad.find({
      category: 'Technology',
      $or: [
        { image: { $exists: true, $ne: null } },
        { video: { $exists: true, $ne: null } }
      ]
    });
    console.log(`✅ Found ${techAdsWithMedia.length} Technology ads with media`);
    
    // Aggregation for media statistics
    const mediaStats = await Ad.aggregate([
      {
        $group: {
          _id: null,
          totalAds: { $sum: 1 },
          adsWithImages: {
            $sum: {
              $cond: [{ $ne: ['$image', null] }, 1, 0]
            }
          },
          adsWithVideos: {
            $sum: {
              $cond: [{ $ne: ['$video', null] }, 1, 0]
            }
          },
          adsWithBoth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$image', null] },
                    { $ne: ['$video', null] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    if (mediaStats.length > 0) {
      const stats = mediaStats[0];
      console.log('✅ Media Statistics:');
      console.log(`   - Total Ads: ${stats.totalAds}`);
      console.log(`   - Ads with Images: ${stats.adsWithImages}`);
      console.log(`   - Ads with Videos: ${stats.adsWithVideos}`);
      console.log(`   - Ads with Both: ${stats.adsWithBoth}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing ad queries:', error);
    throw error;
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

async function runMediaTests() {
  try {
    console.log('🚀 Starting Ad Media Tests...\n');
    
    await connectDB();
    
    const user = await createTestUser();
    const imageAd = await testImageAd(user._id);
    const videoAd = await testVideoAd(user._id);
    const mixedAd = await testAdWithBothMedia(user._id);
    await testValidationErrors();
    await testAdQueries();
    
    console.log('\n✅ All media tests completed successfully!');
    
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
    console.error('❌ Media test suite failed:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runMediaTests();
}

module.exports = {
  runMediaTests,
  testAdWithImage,
  testAdWithVideo
};
