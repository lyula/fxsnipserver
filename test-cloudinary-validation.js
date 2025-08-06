// Test script for Cloudinary media upload functionality
const mongoose = require('mongoose');
require('dotenv').config();

// Import the Ad model
const Ad = require('./models/Ad');

// Test Cloudinary URL validation
async function testCloudinaryValidation() {
  console.log('🧪 Testing Cloudinary URL validation...\n');
  
  // Test data with valid Cloudinary URLs
  const validAdData = {
    title: 'Test Cloudinary Ad',
    description: 'Testing Cloudinary URL validation for ad media content.',
    category: 'Technology',
    image: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
    imagePublicId: 'sample_image_id',
    video: 'https://res.cloudinary.com/demo/video/upload/v1234567890/sample.mp4',
    videoPublicId: 'sample_video_id',
    linkUrl: 'https://example.com/product',
    targetingType: 'global',
    duration: 7,
    targetUserbase: {
      size: '10000',
      label: 'Medium audience',
      multiplier: 1.5
    },
    pricing: {
      basePriceUSD: 2.0,
      totalPriceUSD: 21.0
    },
    userId: new mongoose.Types.ObjectId()
  };

  // Test invalid URLs
  const invalidAdData = {
    ...validAdData,
    title: 'Invalid URL Test',
    image: 'https://invalid-domain.com/image.jpg', // Invalid - not Cloudinary
    imagePublicId: 'invalid_image_id'
  };

  try {
    // Test 1: Valid Cloudinary URLs
    console.log('✅ Testing valid Cloudinary URLs...');
    const validAd = new Ad(validAdData);
    
    try {
      await validAd.validate(); // This will trigger pre-save validation
      console.log('   ✅ Valid Cloudinary URLs passed validation');
    } catch (validationError) {
      console.log('   ❌ Validation failed:', validationError.message);
    }

    // Test 2: Invalid URLs (not Cloudinary)
    console.log('\n✅ Testing invalid URLs (should fail)...');
    const invalidAd = new Ad(invalidAdData);
    
    try {
      await invalidAd.validate();
      console.log('   ❌ Invalid URLs were incorrectly accepted');
    } catch (validationError) {
      console.log('   ✅ Invalid URLs correctly rejected:', validationError.message);
    }

    // Test 3: Missing media (should fail)
    console.log('\n✅ Testing missing media (should fail)...');
    const noMediaData = { ...validAdData };
    delete noMediaData.image;
    delete noMediaData.video;
    delete noMediaData.imagePublicId;
    delete noMediaData.videoPublicId;
    
    const noMediaAd = new Ad(noMediaData);
    
    try {
      await noMediaAd.validate();
      console.log('   ❌ Missing media was incorrectly accepted');
    } catch (validationError) {
      console.log('   ✅ Missing media correctly rejected:', validationError.message);
    }

    // Test 4: Image without public ID (should fail)
    console.log('\n✅ Testing image without public ID (should fail)...');
    const noPublicIdData = { ...validAdData };
    delete noPublicIdData.video;
    delete noPublicIdData.videoPublicId;
    delete noPublicIdData.imagePublicId; // Remove public ID but keep image
    
    const noPublicIdAd = new Ad(noPublicIdData);
    
    try {
      await noPublicIdAd.validate();
      console.log('   ❌ Missing public ID was incorrectly accepted');
    } catch (validationError) {
      console.log('   ✅ Missing public ID correctly rejected:', validationError.message);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }

  console.log('\n🎉 Cloudinary validation tests completed!');
  console.log('\n📋 Summary:');
  console.log('   • Only Cloudinary URLs are accepted for media');
  console.log('   • Public IDs are required when media is provided');
  console.log('   • At least one media type (image or video) is required');
  console.log('   • Invalid URLs are properly rejected');
}

// Test URL pattern matching
function testURLPatterns() {
  console.log('\n🔍 Testing Cloudinary URL patterns...\n');
  
  const testUrls = [
    {
      url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
      expected: true,
      description: 'Valid Cloudinary image URL'
    },
    {
      url: 'https://res.cloudinary.com/mycloud/video/upload/c_scale,w_300/sample.mp4',
      expected: true,
      description: 'Valid Cloudinary video URL with transformations'
    },
    {
      url: 'https://example.com/image.jpg',
      expected: false,
      description: 'Invalid - not Cloudinary domain'
    },
    {
      url: 'http://res.cloudinary.com/demo/image/upload/sample.jpg',
      expected: false,
      description: 'Invalid - HTTP instead of HTTPS'
    },
    {
      url: 'https://cloudinary.com/image/upload/sample.jpg',
      expected: false,
      description: 'Invalid - wrong subdomain'
    }
  ];

  const cloudinaryPattern = /^https:\/\/res\.cloudinary\.com\//;

  testUrls.forEach(test => {
    const result = cloudinaryPattern.test(test.url);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.description}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Expected: ${test.expected}, Got: ${result}\n`);
  });
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Cloudinary Media Upload Tests...\n');
  testURLPatterns();
  await testCloudinaryValidation();
}

runTests().catch(console.error);
