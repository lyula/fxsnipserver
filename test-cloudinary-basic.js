// Simple test to verify Cloudinary implementation
const mongoose = require('mongoose');
const Ad = require('./models/Ad');

async function testBasicFunctionality() {
  console.log('🧪 Testing Basic Cloudinary Implementation...\n');

  // Test 1: Valid ad with Cloudinary image
  console.log('✅ Test 1: Valid ad with Cloudinary image');
  try {
    const imageAd = new Ad({
      title: 'Test Image Ad',
      description: 'Testing Cloudinary image upload functionality.',
      category: 'Technology',
      image: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
      imagePublicId: 'sample_image_id',
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
    });

    await imageAd.validate();
    console.log('   ✅ Image ad validation passed');
  } catch (error) {
    console.log('   ❌ Image ad validation failed:', error.message);
  }

  // Test 2: Valid ad with Cloudinary video
  console.log('\n✅ Test 2: Valid ad with Cloudinary video');
  try {
    const videoAd = new Ad({
      title: 'Test Video Ad',
      description: 'Testing Cloudinary video upload functionality.',
      category: 'Education',
      video: 'https://res.cloudinary.com/demo/video/upload/v1234567890/sample.mp4',
      videoPublicId: 'sample_video_id',
      linkUrl: 'https://example.com/learn',
      targetingType: 'global',
      duration: 5,
      targetUserbase: {
        size: '50000',
        label: 'Large audience',
        multiplier: 2.0
      },
      pricing: {
        basePriceUSD: 3.0,
        totalPriceUSD: 30.0
      },
      userId: new mongoose.Types.ObjectId()
    });

    await videoAd.validate();
    console.log('   ✅ Video ad validation passed');
  } catch (error) {
    console.log('   ❌ Video ad validation failed:', error.message);
  }

  // Test 3: Ad with both image and video
  console.log('\n✅ Test 3: Ad with both image and video');
  try {
    const mixedAd = new Ad({
      title: 'Mixed Media Ad',
      description: 'Testing ad with both Cloudinary image and video.',
      category: 'Trading',
      image: 'https://res.cloudinary.com/demo/image/upload/v1234567890/image.jpg',
      imagePublicId: 'mixed_image_id',
      video: 'https://res.cloudinary.com/demo/video/upload/v1234567890/video.mp4',
      videoPublicId: 'mixed_video_id',
      linkUrl: 'https://example.com/trading',
      targetingType: 'global',
      duration: 10,
      targetUserbase: {
        size: '200000',
        label: 'Very large audience',
        multiplier: 3.0
      },
      pricing: {
        basePriceUSD: 5.0,
        totalPriceUSD: 150.0
      },
      userId: new mongoose.Types.ObjectId()
    });

    await mixedAd.validate();
    console.log('   ✅ Mixed media ad validation passed');
  } catch (error) {
    console.log('   ❌ Mixed media ad validation failed:', error.message);
  }

  // Test 4: Invalid URL (not Cloudinary)
  console.log('\n✅ Test 4: Invalid URL (not Cloudinary) - should fail');
  try {
    const invalidAd = new Ad({
      title: 'Invalid URL Ad',
      description: 'Testing non-Cloudinary URL rejection.',
      category: 'Technology',
      image: 'https://example.com/invalid-image.jpg', // Not Cloudinary
      imagePublicId: 'invalid_id',
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
    });

    await invalidAd.validate();
    console.log('   ❌ Invalid URL was incorrectly accepted');
  } catch (error) {
    console.log('   ✅ Invalid URL correctly rejected:', error.message);
  }

  console.log('\n🎉 Basic Cloudinary functionality tests completed!');
  
  console.log('\n📋 Implementation Summary:');
  console.log('   • Frontend uploads files directly to Cloudinary');
  console.log('   • Backend receives and stores only Cloudinary URLs');
  console.log('   • Database validates URLs are from Cloudinary domain');
  console.log('   • Public IDs stored for proper cleanup on deletion');
  console.log('   • No file processing or storage on our servers');
}

testBasicFunctionality().catch(console.error);
