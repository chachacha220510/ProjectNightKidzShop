# NightKidz Shop E-commerce Platform

<p align="center">
  <img src="storefront/public/images/logo.png" alt="NightKidz Logo" width="200" />
</p>

<h2 align="center">
  Premium Streetwear & Urban Fashion
</h2>

## About NightKidz

NightKidz is a premium streetwear and urban fashion brand catering to fashion-forward individuals who embrace nightlife culture and street aesthetics. Our e-commerce platform provides a seamless shopping experience with a focus on product quality, user experience, and reliable order fulfillment.

## Technology Stack

Our e-commerce platform is built on a modern, performance-focused stack:

- **Backend**: [Medusa.js 2.0](https://medusajs.com/) - Open-source headless commerce platform
- **Storefront**: [Next.js 14](https://nextjs.org/) - React framework with SSR capabilities
- **Admin Panel**: Medusa Admin Dashboard
- **Database**: PostgreSQL
- **Search**: MeiliSearch for powerful product discovery
- **Media Storage**: MinIO for scalable object storage
- **Email**: Resend for transactional emails
- **Payments**: Stripe integration

## Local Development Setup

### Prerequisites

- Node.js (v18+)
- npm or pnpm
- PostgreSQL (v15+) running on port 5433
- Docker (optional, for containerized services)

### Quick Start

#### 1. Clone the Repository

```bash
git clone https://github.com/[your-org]/ProjectNightKidzShop.git
cd ProjectNightKidzShop
```

#### 2. Set Up Local Database

We provide a comprehensive database setup script that handles all necessary configurations:

```bash
./nightkidz-db-setup.js
```

This script will:

- Pull data from the production database
- Replace your local database with production data
- Run all necessary migrations
- Fix common data inconsistencies
- Verify database integrity

#### 3. Configure Environment Variables

```bash
# Backend
cd backend
cp .env.template .env
# Edit .env with your local configuration

# Storefront
cd ../storefront
cp .env.local.template .env.local
# Edit .env.local with your local configuration
```

#### 4. Start Development Servers

**Backend:**

```bash
cd backend
npm run dev
```

The admin panel will be available at: http://localhost:9000/app

**Storefront:**

```bash
cd storefront
npm run dev
```

The storefront will be available at: http://localhost:8000

## Key Features

- **Multi-Region Support**: Serve customers across different regions with localized pricing
- **Inventory Management**: Real-time stock tracking and management
- **Advanced Product Search**: Faceted search with filtering options powered by MeiliSearch
- **Customer Accounts**: User registration, order history, and saved addresses
- **Order Management**: Comprehensive order processing workflow
- **Payment Processing**: Secure checkout with Stripe integration
- **Responsive Design**: Mobile-first approach for all customer-facing interfaces
- **Admin Dashboard**: Complete control over products, orders, and customers

## Deployment

### Production Environment

The NightKidz Shop is deployed on [Railway](https://railway.app) with automatic deployments triggered from the main branch. The production environment uses:

- PostgreSQL database on Railway
- Redis for caching and session management
- MinIO for media storage
- MeiliSearch for product search capabilities

### Deployment Configuration

For production deployments, ensure these environment variables are properly configured:

- `DATABASE_URL`: Production database connection string
- `REDIS_URL`: Redis connection string
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, etc.: MinIO configuration
- `STRIPE_API_KEY`: Stripe payment processing key
- `RESEND_API_KEY`: Email service API key

## Troubleshooting

If you encounter any issues during local development, ensure:

1. PostgreSQL is running on port 5433
2. All required environment variables are correctly set
3. You've run the database setup script
4. Node.js version is compatible (v18+)

For persistent issues, check the backend logs or contact the development team.

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

© 2024 NightKidz, All Rights Reserved
