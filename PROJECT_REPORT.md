# MSME SCHEME RECOMMENDATION PLATFORM - PROJECT REPORT

**Date:** June 2, 2026  
**Project Name:** MSME Scheme Recommendation Platform  
**Type:** Full-Stack Web Application  
**Status:** In Development  

---

## 1. EXECUTIVE SUMMARY

The MSME Scheme Recommendation Platform is a comprehensive web application designed to help Micro, Small, and Medium Enterprises (MSMEs) discover and access government schemes. The platform intelligently recommends appropriate government schemes based on business characteristics and eligibility criteria.

**Key Objective:** Simplify the process for MSMEs to find and apply for relevant government schemes.

---

## 2. PROJECT ARCHITECTURE

### 2.1 Architecture Overview

The project follows a **Client-Server Architecture** with clear separation of concerns:

```
┌─────────────────────────┐
│   Frontend (React)      │
│   Port: 3000            │
└────────────┬────────────┘
             │ HTTP/AXIOS
             ↓
┌─────────────────────────┐
│   Backend (Express.js)  │
│   Port: 8000            │
│   RESTful API           │
└────────────┬────────────┘
             │ SQL
             ↓
┌─────────────────────────┐
│  PostgreSQL Database    │
│  (External/Remote)      │
└─────────────────────────┘
```

### 2.2 Technology Stack

#### **Backend**
- **Runtime:** Node.js with ES6 Modules
- **Framework:** Express.js v5.2.1
- **Database:** PostgreSQL (via pg v8.20.0)
- **ORM:** Sequelize v6.37.8
- **Authentication:** JWT (jsonwebtoken v9.0.3)
- **Security:** bcryptjs v3.0.3 (password hashing)
- **CORS:** Enabled for frontend communication
- **Environment:** Dotenv for configuration management
- **Development:** Nodemon for hot-reloading

#### **Frontend**
- **Framework:** React v18.2.0
- **HTTP Client:** Axios v1.6.0
- **Build Tool:** React Scripts v5.0.1
- **Styling:** CSS (custom stylesheets)
- **State Management:** React Hooks (useState, useEffect)
- **Local Storage:** For session persistence

#### **Database**
- **Type:** PostgreSQL (Relational)
- **Remote Connection:** Configured via environment variables
- **Driver:** pg package for Node.js

---

## 3. PROJECT STRUCTURE

### 3.1 Directory Organization

```
MSME Project/
│
├── Backend/
│   ├── package.json
│   ├── server.js                 (Main entry point)
│   │
│   ├── config/
│   │   └── db.js                 (Database configuration)
│   │
│   ├── controllers/
│   │   ├── authController.js     (Authentication logic)
│   │   ├── schemeController.js   (Scheme management)
│   │   └── userController.js     (User operations)
│   │
│   ├── middleware/
│   │   └── auth.js               (JWT authentication)
│   │
│   ├── models/
│   │   ├── scheme.js             (Scheme data model)
│   │   └── user.js               (User data model)
│   │
│   └── routes/
│       ├── auth.js               (Authentication endpoints)
│       ├── schemes.js            (Scheme endpoints)
│       └── users.js              (User endpoints)
│
└── Frontend/
    ├── package.json
    ├── README.md
    │
    ├── public/
    │   └── index.html            (Root HTML file)
    │
    └── src/
        ├── App.js                (Main component)
        ├── index.js              (Entry point)
        │
        ├── components/           (Reusable components)
        │   ├── ForgotPassword.jsx
        │   ├── MyCollections.jsx
        │   ├── Profile.jsx
        │   ├── RecommendationForm.jsx
        │   ├── RecommendedSchemes.jsx
        │   ├── SchemeDetails.jsx
        │   ├── SignIn.jsx
        │   ├── SignUp.jsx
        │   └── UserProfile.jsx
        │
        ├── Home/
        │   └── Homepage.jsx      (Home page)
        │
        ├── services/
        │   └── api.js            (API client & endpoints)
        │
        └── styles/
            ├── App.css
            ├── ForgotPassword.css
            ├── Homepage.css
            ├── index.css
            ├── MyCollections.css
            ├── Profile.css
            ├── RecommendedSchemes.css
            ├── Recommentationform.css
            ├── SchemeDetails.css
            ├── SignIn.css
            ├── SignUp.css
            └── UserProfile.css
```

---

## 4. CORE FEATURES

### 4.1 Authentication System
- **User Registration (Sign Up)**
  - Email, password, name, and phone number capture
  - Password hashing with bcryptjs
  - Duplicate email prevention
  
- **User Login (Sign In)**
  - Email and password-based authentication
  - JWT token generation
  - Session persistence via localStorage
  
- **Password Management**
  - Forgot password functionality
  - OTP verification for password reset
  - Secure password reset process

### 4.2 User Management
- **User Profile**
  - View personal information
  - Update profile details (name, email, phone)
  - User-specific data retrieval
  
- **User Dashboard**
  - Personalized user experience
  - Collected schemes/favorites
  - Profile management

### 4.3 Scheme Recommendation System
- **Scheme Database**
  - Comprehensive government scheme catalog
  - Scheme details: name, description, category, investment limits
  - Location-based filtering
  - Eligibility criteria and rules
  - Benefits documentation
  - Beneficiary categories
  
- **Recommendation Engine**
  - Intelligent scheme matching based on business characteristics
  - Form-based input collection
  - Personalized scheme suggestions
  
- **Scheme Discovery**
  - Browse all available schemes
  - View detailed scheme information
  - Apply filters by category and location

### 4.4 Collections/Favorites
- Save favorite schemes
- Personal collections management
- Quick access to bookmarked schemes

---

## 5. API ENDPOINTS

### 5.1 Authentication Routes (`/api/auth`)
```
POST   /signup                           - User registration
POST   /login                            - User login
POST   /reset-password/request           - Request password reset
POST   /reset-password/verify-otp        - Verify OTP
POST   /reset-password                   - Reset password
GET    /me                               - Get current user (Protected)
PUT    /profile                          - Update user profile (Protected)
```

### 5.2 User Routes (`/api/users`)
- User profile endpoints
- User data management

### 5.3 Scheme Routes (`/api/schemes`)
- Scheme retrieval
- Scheme filtering
- Scheme details

---

## 6. DATABASE SCHEMA

### 6.1 Users Table
```sql
CREATE TABLE users (
  id                SERIAL PRIMARY KEY
  email             VARCHAR(255) UNIQUE NOT NULL
  password_hash     VARCHAR(255) NOT NULL
  name              VARCHAR(255) NOT NULL
  phone             VARCHAR(15)
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 Schemes Table
```sql
CREATE TABLE schemes (
  id                        SERIAL PRIMARY KEY
  name                      VARCHAR(255) NOT NULL
  description               TEXT
  business_category         VARCHAR(100)
  max_investment            DECIMAL(15, 2)
  location                  VARCHAR(100)
  rules                     JSON
  benefits                  JSON
  beneficiary_categories    JSON
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.3 User Collections/Favorites (Implied)
- Potential linking table for user-scheme relationships
- Enable bookmarking and favorites functionality

---

## 7. SECURITY FEATURES

### 7.1 Implemented Security Measures
- **Password Security:** bcryptjs for password hashing (10 salt rounds)
- **Authentication:** JWT-based token authentication
- **CORS:** Cross-Origin Resource Sharing configured
- **Environment Variables:** Sensitive data stored in .env file
- **Protected Routes:** Middleware authentication for sensitive endpoints
- **Input Validation:** Server-side validation via controllers

### 7.2 Security Best Practices Applied
- Password never stored in plain text
- Tokens used for session management
- Database connections via environment variables
- Secure password reset flow with OTP verification

---

## 8. FRONTEND COMPONENTS

### 8.1 Pages & Views
1. **Homepage** - Landing page with application overview
2. **Sign In** - User login page
3. **Sign Up** - User registration page
4. **Forgot Password** - Password recovery page
5. **Profile** - User profile page
6. **User Profile** - Extended profile information
7. **Recommendation Form** - Input form for scheme recommendations
8. **Recommended Schemes** - Display personalized scheme suggestions
9. **Scheme Details** - Detailed view of individual schemes
10. **My Collections** - Bookmarked/saved schemes

### 8.2 Frontend State Management
- Local component state via `useState` hook
- Global state for: login status, user data, recommendations
- Session persistence using localStorage
- Conditional rendering based on authentication status

---

## 9. BACKEND MODELS & CONTROLLERS

### 9.1 User Model
- `create()` - Register new user with hashed password
- `findByEmail()` - Fetch user by email
- `findById()` - Fetch user by ID
- `update()` - Update user information

### 9.2 Scheme Model
- `create()` - Add new scheme to database
- `findAll()` - Retrieve all schemes
- (Additional methods likely needed: findById, filter, search)

### 9.3 Controllers
- **authController** - Registration, login, password reset, profile management
- **userController** - User data operations
- **schemeController** - Scheme management and recommendations

---

## 10. ENVIRONMENT CONFIGURATION

### 10.1 Required Environment Variables

**Backend (.env)**
```
# Server Configuration
PORT=8000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=msme_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

# Email Configuration (for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_password
```

### 10.2 Configuration Details
- Database connections are externalized via environment variables
- Supports different environments (development, production, testing)
- Sensitive credentials are not version-controlled

---

## 11. API COMMUNICATION

### 11.1 Frontend API Service
- **Location:** `src/services/api.js`
- **HTTP Client:** Axios
- **Base URL:** Configured for backend server
- **Authentication:** JWT tokens attached to requests
- **Error Handling:** Centralized error management

### 11.2 Request/Response Flow
1. Frontend component initiates API call
2. Axios client adds JWT token to headers
3. Request sent to Express backend
4. Authentication middleware validates token
5. Controller processes request
6. Response returned to frontend
7. Frontend updates UI with data

---

## 12. DEVELOPMENT WORKFLOW

### 12.1 Starting the Application

**Backend:**
```bash
cd Backend
npm install
npm start          # Production mode
npm run dev        # Development with hot-reload
```

**Frontend:**
```bash
cd Frontend
npm install
npm start          # Development server on port 3000
```

### 12.2 Build & Deployment

**Frontend Build:**
```bash
npm run build      # Creates optimized production build
```

### 12.3 Development Tools
- **Nodemon:** Automatic backend restart on file changes
- **React Scripts:** Webpack-based frontend bundling
- **Axios:** HTTP client for API communication

---

## 13. CURRENT PROJECT STATUS

### 13.1 Completed Features
✅ Project structure and organization  
✅ Backend server setup with Express.js  
✅ PostgreSQL database configuration  
✅ User authentication system (Sign Up, Sign In, Password Reset)  
✅ JWT-based authorization  
✅ User profile management  
✅ Scheme data model  
✅ Frontend React application  
✅ Responsive UI components  
✅ API client configuration  
✅ Session persistence  
✅ CSS styling for all pages  

### 13.2 Likely In-Progress / Pending
⏳ Complete scheme recommendation algorithm  
⏳ User collections/favorites functionality  
⏳ Advanced filtering and search  
⏳ Email notifications for password reset  
⏳ File upload capability for documents  
⏳ Admin dashboard for scheme management  
⏳ Testing (unit, integration, e2e)  
⏳ Production deployment  
⏳ Performance optimization  
⏳ API documentation (Swagger/OpenAPI)  

---

## 14. POTENTIAL IMPROVEMENTS & RECOMMENDATIONS

### 14.1 Code Quality
- Implement ESLint and Prettier for code consistency
- Add comprehensive error handling and logging
- Implement request validation using libraries like Joi or Yup
- Add TypeScript for type safety
- Implement unit and integration tests (Jest, Mocha)

### 14.2 Database Enhancements
- Create linking table for user-scheme collections
- Add indexes on frequently queried columns
- Implement database migrations
- Add data seeding for development

### 14.3 Security Enhancements
- Implement rate limiting on API endpoints
- Add input sanitization against SQL injection
- Implement HTTPS/SSL in production
- Add API key management
- Implement two-factor authentication (2FA)
- Add audit logging

### 14.4 Frontend Improvements
- Implement React Router for better page navigation
- Add loading states and skeleton screens
- Implement error boundaries
- Add form validation
- Implement lazy loading for components
- Add offline support (Progressive Web App features)

### 14.5 Backend Enhancements
- Implement proper error handling middleware
- Add request logging and monitoring
- Implement caching strategy (Redis)
- Add pagination for large datasets
- Implement API versioning
- Add comprehensive API documentation

### 14.6 DevOps & Deployment
- Set up CI/CD pipeline (GitHub Actions, Jenkins)
- Containerize with Docker
- Implement automated testing in CI/CD
- Set up monitoring and alerting
- Implement database backups
- Set up staging environment

---

## 15. DEPENDENCIES SUMMARY

### Backend Dependencies (8 packages)
| Package | Version | Purpose |
|---------|---------|---------|
| express | 5.2.1 | Web framework |
| pg | 8.20.0 | PostgreSQL driver |
| sequelize | 6.37.8 | ORM |
| jsonwebtoken | 9.0.3 | JWT authentication |
| bcryptjs | 3.0.3 | Password hashing |
| cors | 2.8.6 | CORS middleware |
| dotenv | 17.3.1 | Environment variables |
| nodemon | 3.1.14 (dev) | Development tool |

### Frontend Dependencies (4 packages)
| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2.0 | UI framework |
| react-dom | 18.2.0 | DOM rendering |
| axios | 1.6.0 | HTTP client |
| react-scripts | 5.0.1 | Build tool |

---

## 16. CONCLUSION

The MSME Scheme Recommendation Platform is a well-structured, full-stack web application with:
- Clear separation between frontend and backend
- Secure authentication and authorization mechanisms
- Scalable architecture suitable for expansion
- Modern tech stack (React, Express.js, PostgreSQL)
- User-friendly interface with multiple pages

The project demonstrates good software engineering practices with proper folder organization, environment configuration, and security implementation. With the recommended improvements and completion of pending features, this application will provide significant value to MSME users in discovering and applying for government schemes.

---

## 17. CONTACT & SUPPORT

**For technical clarifications, refer to:**
- Backend setup: Backend/README.md (if available)
- Frontend setup: Frontend/README.md (if available)
- API documentation: [To be created]
- Database schema: config/db.js

---

**Report Generated:** June 2, 2026  
**Report Status:** OFFICIAL PROJECT ANALYSIS
