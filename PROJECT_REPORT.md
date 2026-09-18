# MSME Scheme Recommendation Platform

A full-stack web application that helps **Micro, Small, and Medium Enterprises (MSMEs)** discover relevant government schemes based on their business characteristics and eligibility criteria.

The platform allows users to create an account, manage their profile, explore government schemes, receive personalized scheme recommendations, and save relevant schemes for future reference.

---

## 🚀 Overview

Finding suitable government schemes can be difficult because MSMEs need to evaluate multiple eligibility conditions, business categories, investment limits, beneficiary categories, and location-based requirements.

The **MSME Scheme Recommendation Platform** simplifies this process by collecting relevant user and business information and matching it against scheme eligibility rules stored in the database.

### Core Workflow

```text
User Registration/Login
        ↓
User Profile & Business Information
        ↓
Eligibility Criteria Collection
        ↓
Recommendation Engine
        ↓
Scheme Eligibility Matching
        ↓
Personalized Scheme Recommendations
        ↓
View / Save Relevant Schemes
```

---

## ✨ Key Features

### 🔐 Authentication & Authorization

* User registration and login
* JWT-based authentication
* Password hashing using bcryptjs
* Protected API routes
* Session persistence using localStorage
* Forgot password functionality
* OTP-based password reset
* Secure password reset workflow

### 👤 User Management

* User profile management
* View personal information
* Update name, email, and phone number
* User-specific data retrieval
* Personalized dashboard

### 🎯 Scheme Recommendation

* Government scheme catalog
* Eligibility-based scheme matching
* Business-category filtering
* Location-based filtering
* Investment-limit filtering
* Beneficiary-category matching
* Personalized scheme suggestions

### 🔎 Scheme Discovery

Users can:

* Browse available government schemes
* View detailed scheme information
* Filter schemes by category
* Filter schemes by location
* View eligibility criteria
* View scheme benefits

### ⭐ Saved Schemes

* Save relevant schemes
* Bookmark schemes for later
* Manage personal saved-scheme collection
* Quickly access bookmarked schemes

---

## 🛠️ Tech Stack

### Frontend

| Technology          | Purpose                   |
| ------------------- | ------------------------- |
| React 18.2.0        | User interface            |
| Axios 1.6.0         | API communication         |
| React Hooks         | State management          |
| React Scripts 5.0.1 | Development/build tooling |
| CSS                 | Application styling       |

### Backend

| Technology       | Purpose                        |
| ---------------- | ------------------------------ |
| Node.js          | Backend runtime                |
| Express.js 5.2.1 | REST API framework             |
| Sequelize 6.37.8 | ORM                            |
| PostgreSQL 18    | Relational database            |
| JWT              | Authentication & authorization |
| bcryptjs         | Password hashing               |
| CORS             | Cross-origin communication     |
| dotenv           | Environment configuration      |
| Nodemon          | Development server             |

---

## 🏗️ Application Architecture

```text
┌───────────────────────────────┐
│           React UI            │
│                               │
│  Login | Dashboard | Schemes  │
│  Profile | Recommendations    │
└───────────────┬───────────────┘
                │
                │ Axios / REST API
                ▼
┌───────────────────────────────┐
│       Express.js Server       │
│                               │
│  Authentication Middleware    │
│  Controllers                 │
│  Routes                      │
│  Recommendation Logic        │
└───────────────┬───────────────┘
                │
                │ Sequelize / pg
                ▼
┌───────────────────────────────┐
│        PostgreSQL             │
│                               │
│ Users                         │
│ Schemes                       │
│ User Saved Schemes            │
└───────────────────────────────┘
```

---

## 🔑 Authentication Flow

The application uses **JWT-based authentication**.

```text
Register
   ↓
Password hashed using bcryptjs
   ↓
User stored in PostgreSQL
   ↓
Login
   ↓
Credentials verified
   ↓
JWT generated
   ↓
Token stored on client
   ↓
Protected API requests
```

Sensitive routes are protected using authentication middleware.

---

## 🎯 Recommendation System

The recommendation system matches user-provided business information against scheme eligibility rules.

### Matching Criteria

The scheme database contains information such as:

* Business category
* Investment limit
* Location
* Eligibility rules
* Benefits
* Beneficiary categories

The recommendation process can be represented as:

```text
User Information
       ↓
Eligibility Criteria
       ↓
Compare with Scheme Rules
       ↓
Filter Eligible Schemes
       ↓
Return Matching Schemes
```

This allows users to discover schemes that are relevant to their business characteristics instead of manually searching through the entire scheme catalog.

---

## 🗄️ Database Design

### Users

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    reset_otp VARCHAR(6),
    reset_otp_expires TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Schemes

```sql
CREATE TABLE schemes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    business_category VARCHAR(100),
    max_investment DECIMAL(15, 2),
    location VARCHAR(100),
    rules JSON,
    benefits JSON,
    beneficiary_categories JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Saved Schemes

```sql
CREATE TABLE user_saved_schemes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheme_id INT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, scheme_id)
);
```

---

## 🔌 REST API

### Authentication — `/api/auth`

| Method | Endpoint                     | Description                    |
| ------ | ---------------------------- | ------------------------------ |
| POST   | `/signup`                    | Register a new user            |
| POST   | `/login`                     | Authenticate user              |
| POST   | `/reset-password/request`    | Request password reset         |
| POST   | `/reset-password/verify-otp` | Verify reset OTP               |
| POST   | `/reset-password`            | Reset password                 |
| GET    | `/me`                        | Get current authenticated user |
| PUT    | `/profile`                   | Update user profile            |

### Users — `/api/users`

Provides endpoints for:

* User profile management
* User-specific data
* User information retrieval

### Schemes — `/api/schemes`

Provides endpoints for:

* Scheme retrieval
* Scheme filtering
* Scheme details
* Scheme discovery

---

## 🔒 Security

The application implements several security practices:

* **bcryptjs** for password hashing
* **JWT** for authentication and authorization
* Protected routes using authentication middleware
* Server-side input validation
* CORS configuration
* Environment variables for sensitive configuration
* OTP verification for password reset
* Passwords are never stored in plain text

---

## 📁 Project Structure

```text
MSME-SCHEME-RECOMMENDATION-SYSTEM/
│
├── Backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── Frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have installed:

* Node.js
* npm
* PostgreSQL

---

### 1. Clone the Repository

```bash
git clone https://github.com/bharathganesh45/msme-scheme-recommendation-system.git

cd msme-scheme-recommendation-system
```

### 2. Backend Setup

```bash
cd Backend
npm install
npm run dev
```

### 3. Frontend Setup

Open another terminal:

```bash
cd Frontend
npm install
npm start
```

The React development server runs using the configured React Scripts setup, while the backend is started through Nodemon during development.

---

## 🔐 Environment Variables

Create a `.env` file inside the backend directory.

```env
PORT=5000

DATABASE_URL=your_postgresql_connection_string

JWT_SECRET=your_jwt_secret

# Add other environment-specific configuration
# required by your backend
```

> **Important:** Never commit `.env` files, passwords, database credentials, API keys, or JWT secrets to GitHub.

---

## 📊 Main Functional Modules

```text
Authentication
├── Sign Up
├── Sign In
├── Forgot Password
├── OTP Verification
└── Password Reset

User Management
├── Profile
├── Dashboard
└── Saved Schemes

Scheme Management
├── Browse Schemes
├── Scheme Details
├── Filtering
└── Eligibility Matching

Recommendation
├── User Input
├── Eligibility Rules
├── Scheme Matching
└── Personalized Results
```

---

## ✅ Implemented Features

* Full-stack React + Node.js application
* Express.js REST API
* PostgreSQL database integration
* User registration and login
* JWT authentication
* Password hashing
* Password reset with OTP verification
* User profile management
* Government scheme data model
* Scheme filtering
* Recommendation functionality
* Saved schemes/favorites
* Responsive React UI
* API client integration
* Session persistence
* Environment-based configuration

---

## 🔮 Future Improvements

Potential improvements include:

* Advanced recommendation scoring
* More government schemes and regularly updated scheme data
* Improved eligibility-rule engine
* Admin dashboard for scheme management
* Scheme application tracking
* Email notifications
* Advanced search
* Analytics dashboard
* Automated scheme-data updates
* Deployment and production monitoring

---

## 🎓 What I Learned

Through this project, I gained practical experience in:

* Building a full-stack web application
* Designing REST APIs
* React frontend development
* Node.js and Express.js backend development
* PostgreSQL database design
* JWT authentication
* Password security using bcryptjs
* Protected API routes
* Frontend-backend integration using Axios
* Environment-based configuration
* Structuring a scalable application

---

## 👨‍💻 Developer

**Bharath Ganesh**

Bachelor's in Electrical and Electronics Engineering
Full-Stack Developer | React | Node.js | Express.js | PostgreSQL

---

## 📄 License

This project was developed for educational and portfolio purposes.


