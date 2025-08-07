const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createAd,
  getUserAds,
  getAdById,
  updateAd,
  deleteAd,
  calculatePricing,
  submitAdForApproval,
  getExchangeRates,
  getActiveAds
} = require('../controllers/adController');
const { protect } = require('../middleware/auth');

// Validation rules for ad creation
const adValidationRules = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  
  body('category')
    .isIn(['Finance', 'Education', 'Technology', 'Health', 'Lifestyle', 'Trading', 'Forex', 'Crypto', 'Events', 'Jobs'])
    .withMessage('Invalid category'),
  
  body('image')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Allow single URL or array of URLs
      if (typeof value === 'string') {
        return /^https?:\/\//.test(value);
      }
      if (Array.isArray(value)) {
        if (value.length > 5) return false; // Max 5 images
        return value.every(url => typeof url === 'string' && /^https?:\/\//.test(url));
      }
      return false;
    })
    .withMessage('Image must be a valid URL or array of URLs (max 5)'),
  
  body('imagePublicId')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Allow single string or array of strings
      if (typeof value === 'string') return true;
      if (Array.isArray(value)) {
        return value.every(id => typeof id === 'string');
      }
      return false;
    })
    .withMessage('Image public ID must be a string or array of strings'),
  
  body('video')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Allow single URL or array of URLs
      if (typeof value === 'string') {
        return /^https?:\/\//.test(value);
      }
      if (Array.isArray(value)) {
        if (value.length > 3) return false; // Max 3 videos
        return value.every(url => typeof url === 'string' && /^https?:\/\//.test(url));
      }
      return false;
    })
    .withMessage('Video must be a valid URL or array of URLs (max 3)'),
  
  body('videoPublicId')
    .optional()
    .custom((value) => {
      if (!value) return true;
      // Allow single string or array of strings
      if (typeof value === 'string') return true;
      if (Array.isArray(value)) {
        return value.every(id => typeof id === 'string');
      }
      return false;
    })
    .withMessage('Video public ID must be a string or array of strings'),
  
  body('linkUrl')
    .if(body('contactMethod').equals('link'))
    .isURL()
    .withMessage('Link URL must be a valid URL'),
  
  body('targetingType')
    .isIn(['global', 'specific'])
    .withMessage('Targeting type must be either global or specific'),
  
  body('duration')
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1 and 365 days'),
  
  body('targetUserbase')
    .isIn(['1000', '10000', '50000', '200000', '1000000'])
    .withMessage('Invalid target userbase size'),
  
  body('targetCountries')
    .optional()
    .isArray()
    .withMessage('Target countries must be an array'),
  
  body('targetCountries.*.name')
    .optional()
    .isString()
    .withMessage('Country name must be a string'),
  
  body('targetCountries.*.tier')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('Country tier must be 1, 2, or 3')
];

// Validation rules for pricing calculation
const pricingValidationRules = [
  body('targetingType')
    .isIn(['global', 'specific'])
    .withMessage('Targeting type must be either global or specific'),
  
  body('duration')
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be between 1 and 365 days'),
  
  body('targetUserbase')
    .isIn(['1000', '10000', '50000', '200000', '1000000'])
    .withMessage('Invalid target userbase size'),
  
  body('targetCountries')
    .optional()
    .isArray()
    .withMessage('Target countries must be an array')
];

// Public routes
router.get('/exchange-rates', getExchangeRates);
router.get('/active', getActiveAds);

// Protected routes (require authentication)
router.use(protect);

// Ad CRUD operations
router.route('/')
  .get(getUserAds)
  .post(adValidationRules, createAd);

router.route('/:id')
  .get(getAdById)
  .put(adValidationRules, updateAd)
  .delete(deleteAd);

// Ad-specific operations
router.post('/calculate-pricing', pricingValidationRules, calculatePricing);
router.post('/:id/submit', submitAdForApproval);

module.exports = router;
