/**
 * Seed Default Report Reasons
 * Run this script once to populate the database with default report reasons
 * 
 * Usage: node server/scripts/seedReportReasons.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forex-journal', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const ReportReason = require('../models/ReportReason');

const defaultReasons = [
  {
    reason: "It's spam",
    description: 'Misleading or repetitive content',
    order: 1,
    isActive: true
  },
  {
    reason: 'Nudity or sexual activity',
    description: 'Inappropriate sexual content',
    order: 2,
    isActive: true
  },
  {
    reason: 'Hate speech or symbols',
    description: 'Hateful content targeting individuals or groups',
    order: 3,
    isActive: true
  },
  {
    reason: 'Violence or dangerous organizations',
    description: 'Content promoting violence or dangerous groups',
    order: 4,
    isActive: true
  },
  {
    reason: 'Bullying or harassment',
    description: 'Content that bullies, harasses, or targets individuals',
    order: 5,
    isActive: true
  },
  {
    reason: 'Selling or promoting restricted items',
    description: 'Illegal sales or promotion of restricted goods',
    order: 6,
    isActive: true
  },
  {
    reason: 'Intellectual property violation',
    description: 'Copyright or trademark infringement',
    order: 7,
    isActive: true
  },
  {
    reason: 'Suicide, self-injury or eating disorders',
    description: 'Content promoting self-harm or eating disorders',
    order: 8,
    isActive: true
  },
  {
    reason: 'Scam or fraud',
    description: 'Deceptive practices or fraudulent content',
    order: 9,
    isActive: true
  },
  {
    reason: 'False information',
    description: 'Misinformation or false claims',
    order: 10,
    isActive: true
  },
  {
    reason: "I just don't like it",
    description: 'General dislike without specific violation',
    order: 11,
    isActive: true
  }
];

async function seedReportReasons() {
  try {
    console.log('🌱 Seeding default report reasons...');

    // Check if reasons already exist
    const existingCount = await ReportReason.countDocuments();
    if (existingCount > 0) {
      console.log(`ℹ️  Found ${existingCount} existing report reasons.`);
      console.log('Do you want to:');
      console.log('1. Skip seeding (keep existing)');
      console.log('2. Add missing reasons only');
      console.log('3. Clear all and re-seed');
      
      // For automated script, we'll add missing only
      console.log('Adding missing reasons only...');
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const reasonData of defaultReasons) {
      try {
        const existing = await ReportReason.findOne({ reason: reasonData.reason });
        
        if (existing) {
          console.log(`⏭️  Skipped: "${reasonData.reason}" (already exists)`);
          skippedCount++;
        } else {
          await ReportReason.create(reasonData);
          console.log(`✅ Added: "${reasonData.reason}"`);
          addedCount++;
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⏭️  Skipped: "${reasonData.reason}" (duplicate)`);
          skippedCount++;
        } else {
          throw error;
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Added: ${addedCount} reasons`);
    console.log(`⏭️  Skipped: ${skippedCount} reasons`);
    console.log(`📝 Total in database: ${await ReportReason.countDocuments()} reasons`);
    
    console.log('\n✨ Report reasons seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding report reasons:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seeder
seedReportReasons();
