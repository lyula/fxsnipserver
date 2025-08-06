# Forex Journal - Ad Management System

A comprehensive advertising platform integrated into the Forex Journal application, allowing users to create, manage, and track advertisements with **images and videos**, advanced targeting options, and real-time pricing.

## 🌟 Features

### Core Functionality
- **Multi-Media Support**: Upload and display images or videos in ads (similar to social media posts)
- **Multi-Currency Support**: USD base pricing with real-time currency conversion
- **Global & Country Targeting**: Target specific countries or go global
- **Dynamic Pricing**: Competitive rates based on userbase size and duration
- **Real-time Validation**: Comprehensive form validation with instant feedback
- **Payment Integration**: Ready for Stripe/PayPal integration
- **Admin Dashboard**: Full administrative control and analytics

### Advanced Features
- **Media Upload & Management**: Cloudinary integration for image/video hosting
- **Live Ad Preview**: Real-time preview of ads as users create them
- **Scheduled Tasks**: Automated ad lifecycle management
- **Performance Tracking**: Real-time metrics and analytics
- **Rate Limiting**: Prevents spam and abuse
- **Role-based Access**: User and admin permissions
- **Exchange Rate API**: Live currency conversion rates

## 🎨 Media Support

### Supported Formats
- **Images**: JPG, PNG, GIF, WebP
- **Videos**: MP4, WebM, MOV (auto-converted to MP4)
- **Storage**: Cloudinary cloud storage with CDN delivery
- **Upload Size**: Up to 10MB for images, 100MB for videos

### Media Requirements
- Each ad must include **either** an image **or** a video (one is required)
- All media is automatically optimized for web delivery
- Videos include playback controls and mobile optimization
- Images support zoom functionality and responsive display

## 🏗️ Architecture

### Frontend (React.js)
```
src/components/
├── AdCreation.jsx            # Form with media upload & preview
├── AdCard.jsx               # Ad display component with media support
├── AdPreview.jsx            # Live preview component
└── MediaDisplay.jsx         # Reusable media display component
```

### Backend (Node.js/Express)
```
server/
├── models/Ad.js              # MongoDB schema with media fields
├── controllers/
│   ├── adController.js       # Core CRUD with media handling
│   ├── adminAdController.js  # Admin management
│   └── paymentController.js  # Payment processing
├── routes/
│   ├── ads.js               # User ad routes with validation
│   ├── adminAds.js          # Admin routes
│   └── payments.js          # Payment routes
├── middleware/
│   ├── adValidation.js      # Custom validation middleware
│   └── auth.js              # Authentication
├── services/
│   └── adService.js         # Scheduled tasks & utilities
└── tests/
    ├── adTest.js            # Core functionality tests
    └── adMediaTest.js       # Media-specific tests
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MongoDB
- npm/pnpm

### Installation

1. **Clone and setup server:**
```bash
cd server
pnpm install
```

2. **Environment Configuration:**
Create a `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/forex-journal
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
```

3. **Start the server:**
```bash
pnpm run dev
```

4. **Run tests:**
```bash
node tests/adTest.js
```

### Frontend Setup
```bash
cd client
pnpm install
pnpm run dev
```

## 📊 API Documentation

### User Endpoints

#### Create Ad
```http
POST /api/ads
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Product Launch Campaign",
  "description": "Promoting our new product that will revolutionize your workflow.",
  "category": "Technology",
  "image": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/ads/image.jpg",
  "imagePublicId": "ads/image_abc123",
  "video": null,
  "videoPublicId": null,
  "linkUrl": "https://example.com/product",
  "targetingType": "specific",
  "targetCountries": [
    {"name": "United States", "code": "US", "tier": 1},
    {"name": "Canada", "code": "CA", "tier": 1}
  ],
  "duration": 7,
  "targetUserbase": "50000",
  "userCountry": "United States"
}
```

#### Get User Ads
```http
GET /api/ads?status=active&page=1&limit=10
Authorization: Bearer <token>
```

#### Update Ad
```http
PUT /api/ads/:id
Authorization: Bearer <token>
```

### Admin Endpoints

#### Approve/Reject Ad
```http
POST /api/admin/ads/:id/approve
POST /api/admin/ads/:id/reject
Authorization: Bearer <admin_token>

{
  "reason": "Approval/rejection reason"
}
```

#### Analytics
```http
GET /api/admin/ads/analytics
Authorization: Bearer <admin_token>
```

### Payment Endpoints

#### Process Payment
```http
POST /api/payments/ads/:id
Authorization: Bearer <token>

{
  "paymentMethod": "stripe",
  "paymentDetails": {
    "token": "stripe_token_here"
  }
}
```

## 💰 Pricing Structure

### Base Pricing (USD)
- **Country Targeting**: $1-5/day based on userbase size
- **Global Targeting**: $10-50/day based on userbase size

### Userbase Tiers
| Users | Daily Rate (Country) | Daily Rate (Global) |
|-------|---------------------|-------------------|
| 10,000 | $1.00 | $10.00 |
| 25,000 | $1.50 | $15.00 |
| 50,000 | $2.50 | $25.00 |
| 100,000 | $4.00 | $40.00 |
| 250,000+ | $5.00 | $50.00 |

### Currency Support
- Base currency: USD
- Supported display currencies: EUR, GBP, CAD, AUD, JPY, etc.
- Real-time exchange rates via ExchangeRate-API

## 🔧 Configuration

### Exchange Rate API
The system uses [ExchangeRate-API](https://www.exchangerate-api.com/) for live currency conversion:

```javascript
// Automatic rate fetching
const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
const data = await response.json();
```

### Scheduled Tasks
Automated processes run via cron jobs:

- **Hourly**: Check expired ads, activate scheduled ads
- **Twice Daily**: Send payment reminders
- **Daily**: Generate performance reports
- **Weekly**: Clean up old draft ads

### Database Schema

#### Ad Model
```javascript
{
  userId: ObjectId,           // Reference to User
  title: String,              // Ad title (required)
  description: String,        // Ad description (required)
  category: String,           // Ad category (required)
  
  // Media Content (at least one required)
  image: String,              // Cloudinary image URL
  imagePublicId: String,      // Cloudinary public ID for deletion
  video: String,              // Cloudinary video URL  
  videoPublicId: String,      // Cloudinary public ID for deletion
  linkUrl: String,            // Destination URL (required)
  
  targetingType: String,      // 'global' or 'specific'
  targetCountries: [{         // Required if specific targeting
    name: String,             // Country name
    code: String,             // ISO country code
    tier: Number              // Pricing tier (1-3)
  }],
  
  duration: Number,           // Campaign duration in days
  targetUserbase: {
    size: String,             // Audience size identifier
    label: String,            // Human-readable label
    multiplier: Number        // Pricing multiplier
  },
  
  pricing: {
    basePriceUSD: Number,     // Base price per day
    totalPriceUSD: Number,    // Total campaign cost
    userCurrency: {
      code: String,           // User's currency code
      symbol: String,         // Currency symbol
      rate: Number,           // Exchange rate used
      convertedPrice: Number  // Price in user's currency
    }
  },
  
  status: String,             // Campaign status
  
  performance: {
    impressions: Number,      // Total impressions
    clicks: Number,           // Total clicks
    clickThroughRate: Number, // CTR percentage
    reach: Number,            // Unique users reached
    engagement: Number        // Engagement interactions
  },
  
  schedule: {
    startDate: Date,          // Campaign start
    endDate: Date,            // Campaign end (auto-calculated)
    timeZone: String          // Timezone for scheduling
  },
  
  paymentInfo: {
    paymentId: String,        // Payment processor ID
    paymentStatus: String,    // Payment status
    paymentMethod: String,    // Payment method used
    transactionId: String,    // Transaction reference
    paidAt: Date             // Payment timestamp
  },
  
  // Admin fields
  isApproved: Boolean,        // Admin approval status
  approvedBy: ObjectId,       // Admin who approved
  approvedAt: Date,          // Approval timestamp
  rejectionReason: String     // Reason if rejected
}
```

## 🧪 Testing

### Running Tests
```bash
# Run the comprehensive test suite
node tests/adTest.js

# The test will:
# ✅ Create test user and ads
# ✅ Test all model methods
# ✅ Validate database queries
# ✅ Test global targeting
# ✅ Verify validation rules
# ✅ Clean up test data (optional)
```

### Test Coverage
- Model validation and methods
- Currency conversion
- Targeting logic
- Schedule validation
- Performance tracking
- Database queries and aggregations

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (user/admin)
- Ad ownership validation
- Rate limiting on ad creation

### Data Validation
- Express-validator middleware
- Custom validation for targeting and scheduling
- MongoDB schema validation
- XSS protection on user inputs

### Payment Security
- Secure token handling
- Transaction logging
- Refund capabilities
- Fraud detection ready

## 📈 Analytics & Monitoring

### Performance Metrics
- Impressions and clicks tracking
- Click-through rate (CTR) calculation
- Revenue analytics
- Campaign performance reports

### Admin Dashboard Features
- Ad approval/rejection workflow
- Revenue analytics by date/country
- User activity monitoring
- System health metrics

## 🔄 Automated Processes

### Ad Lifecycle Management
1. **Creation**: User creates ad (draft status)
2. **Submission**: Ad submitted for approval
3. **Review**: Admin approves/rejects
4. **Payment**: User completes payment
5. **Activation**: Ad becomes active on start date
6. **Completion**: Ad completes on end date
7. **Cleanup**: Old drafts automatically removed

### Notification System
- Payment reminders for pending ads
- Status update notifications
- Performance milestone alerts
- Admin approval notifications

## 🛠️ Development

### Adding New Features

1. **New Targeting Options**:
   - Update `Ad.js` schema
   - Modify validation middleware
   - Update pricing calculations
   - Add frontend controls

2. **Payment Providers**:
   - Extend `paymentController.js`
   - Add provider-specific routes
   - Update payment validation

3. **Analytics**:
   - Add new aggregation queries
   - Create visualization components
   - Update admin dashboard

### Code Structure Guidelines
- Controllers handle business logic
- Models define data structure
- Middleware handles validation
- Services manage background tasks
- Tests ensure reliability

## 🚀 Deployment

### Production Checklist
- [ ] Set production environment variables
- [ ] Configure MongoDB replica set
- [ ] Set up Redis for rate limiting
- [ ] Configure payment gateway
- [ ] Set up monitoring and logging
- [ ] Enable HTTPS
- [ ] Configure backup strategy

### Environment Variables
```env
NODE_ENV=production
MONGODB_URI=mongodb://production-cluster
JWT_SECRET=production-secret
STRIPE_SECRET_KEY=sk_live_...
PAYPAL_CLIENT_ID=production-client-id
EXCHANGE_RATE_API_KEY=your-api-key
```

## 📞 Support

For issues and questions:
1. Check the test suite output
2. Review API documentation
3. Check server logs for errors
4. Verify environment configuration

## 🤝 Contributing

1. Follow existing code structure
2. Add tests for new features
3. Update documentation
4. Ensure backward compatibility

## 📄 License

This project is part of the Forex Journal application.

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Compatibility**: Node.js 16+, React 18+, MongoDB 5+
