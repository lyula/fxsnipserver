/**
 * Backfill Script for "Follow" Notifications
 * 
 * This script identifies users who were followed (exist in followersHashed arrays)
 * but never received "followed you" notifications due to the previous schema issue
 * where "follow" was not included in the Notification model enum.
 * 
 * Usage: node backfill-follow-notifications.js [--dry-run]
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Notification = require('./models/Notification');

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forex-journal');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Utility function to convert hashed ID back to ObjectId
const hashToObjectId = (hashedId) => {
  try {
    // Assuming the hash is just the ObjectId string - adjust if using actual hashing
    return new mongoose.Types.ObjectId(hashedId);
  } catch (error) {
    console.warn(`Invalid hashed ID: ${hashedId}`);
    return null;
  }
};

// Main backfill function
const backfillFollowNotifications = async (dryRun = false) => {
  console.log(`\n Starting backfill process ${dryRun ? '(DRY RUN)' : '(LIVE RUN)'}...\n`);

  let totalProcessed = 0;
  let totalNotificationsCreated = 0;
  let totalErrors = 0;

  try {
    // Get all users who have followers
    const usersWithFollowers = await User.find({
      followersHashed: { $exists: true, $not: { $size: 0 } }
    }).select('_id username followersHashed');

    console.log(` Found ${usersWithFollowers.length} users with followers to process\n`);

    for (const user of usersWithFollowers) {
      console.log(`Processing user: ${user.username} (${user._id})`);
      console.log(`  Followers count: ${user.followersHashed.length}`);

      let notificationsCreatedForUser = 0;

      for (const followerHashedId of user.followersHashed) {
        totalProcessed++;

        try {
          // Convert hashed ID to ObjectId
          const followerId = hashToObjectId(followerHashedId);
          if (!followerId) {
            console.warn(`      Skipping invalid follower ID: ${followerHashedId}`);
            continue;
          }

          // Check if a follow notification already exists for this relationship
          const existingNotification = await Notification.findOne({
            user: user._id,     // notification recipient (the followed user)
            from: followerId,   // notification sender (the follower)
            type: 'follow'
          });

          if (existingNotification) {
            console.log(`     Notification already exists for follower ${followerId}`);
            continue;
          }

          // Verify the follower user exists
          const followerUser = await User.findById(followerId).select('username');
          if (!followerUser) {
            console.warn(`      Follower user not found: ${followerId}`);
            continue;
          }

          // Create the missing follow notification
          const notificationData = {
            user: user._id,     // recipient (the followed user)
            from: followerId,   // actor (the follower)
            type: 'follow',
            message: `${followerUser.username} followed you`,
            read: false,
            createdAt: new Date() // Current time - we can't determine exact follow time
          };

          if (!dryRun) {
            const notification = new Notification(notificationData);
            await notification.save();
            console.log(`     Created follow notification: ${followerUser.username}  ${user.username}`);
          } else {
            console.log(`     [DRY RUN] Would create notification: ${followerUser.username}  ${user.username}`);
          }

          notificationsCreatedForUser++;
          totalNotificationsCreated++;

        } catch (error) {
          totalErrors++;
          console.error(`     Error processing follower ${followerHashedId}:`, error.message);
        }
      }

      console.log(`   ${notificationsCreatedForUser} notifications ${dryRun ? 'would be' : 'were'} created for ${user.username}\n`);
    }

  } catch (error) {
    console.error(' Fatal error during backfill process:', error);
    totalErrors++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(' BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total relationships processed: ${totalProcessed}`);
  console.log(`Total notifications ${dryRun ? 'to be created' : 'created'}: ${totalNotificationsCreated}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE RUN (changes applied)'}`);
  console.log('='.repeat(60) + '\n');

  return {
    processed: totalProcessed,
    created: totalNotificationsCreated,
    errors: totalErrors
  };
};

// Validation function to check current state
const validateCurrentState = async () => {
  console.log('\n Validating current database state...\n');

  try {
    // Check notification schema supports 'follow' type
    const sampleFollowNotification = new Notification({
      user: new mongoose.Types.ObjectId(),
      from: new mongoose.Types.ObjectId(),
      type: 'follow',
      message: 'Test follow notification'
    });

    const validationError = sampleFollowNotification.validateSync();
    if (validationError) {
      console.error(' Notification schema validation failed:');
      console.error(validationError.message);
      return false;
    }

    console.log(' Notification schema supports "follow" type');

    // Count existing follow notifications
    const existingFollowNotifications = await Notification.countDocuments({ type: 'follow' });
    console.log(` Found ${existingFollowNotifications} existing follow notifications`);

    // Count users with followers
    const usersWithFollowers = await User.countDocuments({
      followersHashed: { $exists: true, $not: { $size: 0 } }
    });
    console.log(` Found ${usersWithFollowers} users with followers`);

    return true;

  } catch (error) {
    console.error(' Validation failed:', error.message);
    return false;
  }
};

// Main execution
const main = async () => {
  console.log(' Follow Notifications Backfill Script');
  console.log('========================================\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log(' Running in DRY RUN mode - no changes will be made\n');
  } else {
    console.log('  Running in LIVE mode - changes will be applied to database\n');
  }

  try {
    // Connect to database
    await connectDB();

    // Validate current state
    const isValid = await validateCurrentState();
    if (!isValid) {
      console.error('\n Database validation failed. Please fix issues before running backfill.');
      process.exit(1);
    }

    // Run backfill
    const results = await backfillFollowNotifications(dryRun);

    if (dryRun) {
      console.log('\n To apply these changes, run the script without --dry-run flag:');
      console.log('   node backfill-follow-notifications.js\n');
    } else {
      console.log('\n Backfill completed successfully!\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n Script execution failed:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log(' Database connection closed');
    }
  }
};

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n\n  Script interrupted by user');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log(' Database connection closed');
  }
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { backfillFollowNotifications, validateCurrentState };
