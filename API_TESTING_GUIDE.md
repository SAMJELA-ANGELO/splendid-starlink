# API Testing Guide

## 🌟 Latest Updates (April 2026)

### New Features Added:
- ✅ User Reactivation - Users can reconnect after session expiry by purchasing new bundles
- ✅ Gift Purchase Flow - Send WiFi access as gifts to new or existing users
- ✅ Payment Success Page - Beautiful status page after successful payment
- ✅ Auto-Redirect Flow - Seamless redirect from payment success to login portal
- ✅ Email Sanitization - Robust email validation and formatting
- ✅ Multi-Router Failover - Graceful fallback between multiple MikroTik routers

---

## Swagger Documentation
All endpoints are fully documented and ready to test in Swagger:
- **URL**: `http://localhost:3000/docs`

---

## 💳 Payment System Endpoints

### 1. Initiate Payment (Bundle Purchase)
- **Path**: `POST /payments/initiate`
- **Auth**: Not required (public)
- **Description**: Start a bundle purchase via Fapshi mobile money
- **Request Body**:
```json
{
  "planId": "507f1f77bcf86cd799439011",
  "phone": "237123456789",
  "email": "john@example.com",
  "macAddress": "02:1A:2B:3C:4D:5E",
  "userIp": "192.168.1.100",
  "routerIdentity": "Home",
  "password": "secure123",
  "externalId": "ext_12345",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "transId": "ABC123DEF456",
  "phone": "237123456789",
  "amount": 1000,
  "currency": "XAF",
  "redirect": "https://webhook.example.com",
  "status": "created"
}
```

### 2. Initiate Gift Purchase
- **Path**: `POST /payments/initiate` (with gift parameters)
- **Auth**: Not required
- **Description**: Send WiFi bundle as gift to recipient
- **Request Body**:
```json
{
  "planId": "507f1f77bcf86cd799439011",
  "phone": "237123456789",
  "email": "payer@example.com",
  "isGift": true,
  "recipientUsername": "recipient_user",
  "password": "recipient_password_or_generated",
  "externalId": "gift_12345",
  "name": "John Doe"
}
```

**Note**: 
- If `recipientUsername` doesn't exist, it will be created
- If recipient exists but is deactivated, they will be reactivated
- Password can be auto-generated if not provided
- No device info (MAC/IP) needed for gifts - recipient logs in manually

### 3. Check Payment Status
- **Path**: `GET /payments/status/:transactionId`
- **Auth**: Not required
- **Description**: Poll Fapshi for payment status
- **Path Parameters**: 
  - `transactionId` - Transaction ID from initiate response
  
**Response (Successful Payment)**:
```json
{
  "status": "SUCCESSFUL",
  "transId": "ABC123DEF456",
  "activation": {
    "success": true,
    "username": "john_doe",
    "sessionExpiry": "2026-04-02T18:30:00Z",
    "readyForSilentLogin": true,
    "wasReactivation": false,
    "isGift": false,
    "message": "User activated - ready for silent login"
  },
  "isGift": false,
  "recipientUsername": null,
  "message": "Payment completed and user activated"
}
```

**Response (Gift Payment)**:
```json
{
  "status": "SUCCESSFUL",
  "transId": "GIFT123456",
  "activation": {
    "success": true,
    "username": "recipient_user",
    "sessionExpiry": "2026-04-02T18:30:00Z",
    "readyForSilentLogin": false,
    "isGift": true,
    "message": "Gift activated for recipient_user - recipient can now log in manually"
  },
  "isGift": true,
  "recipientUsername": "recipient_user",
  "message": "Gift payment completed"
}
```

### 4. Get Payment History
- **Path**: `GET /payments/history`
- **Auth**: Required (Bearer JWT)
- **Description**: Retrieve user's payment and invoice history
- **Response**: Array of invoices with plan details, amounts, dates, and gift status

---

## 🎁 Gift Purchase Workflow

### Complete Gift Flow (Step-by-Step)

**1. Payer Initiates Gift**
```bash
curl -X POST http://localhost:3001/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "507f1f77bcf86cd799439011",
    "phone": "237123456789",
    "email": "payer@example.com",
    "isGift": true,
    "recipientUsername": "Alice",
    "password": "AlicePass123",
    "externalId": "gift_timestamp"
  }'
```

**2. System Creates/Reactivates Recipient Automatically**
- ✅ Checks if "Alice" exists
- If not: Creates new user with:
  - Username: Alice
  - Email: alice@splendidstarlink.com
  - Password: AlicePass123
  - Status: Inactive (until payment confirms)
- If exists but inactive: Marks for reactivation
- If exists and active: Extends session

**3. Payer Sends Mobile Money**
- User receives prompt on phone
- Confirms payment via M-Pesa/Orange Money
- Fapshi confirms transaction

**4. Webhook Activation**
- Backend receives webhook notification
- Creates/updates MikroTik hotspot user for "Alice"
- Sets session duration for recipient
- Updates MongoDB with isActive: true
- Logs activity with gift flag and reactivation status

**5. Payer Sees Success Page**
```
┌─────────────────────────────┐
│  ✅ Payment Successful!     │
│                             │
│  Gift sent to: Alice       │
│  Duration: 24 hours        │
│                             │
│  Login credentials:        │
│  Username: alice           │
│  Password: AlicePass123    │
└─────────────────────────────┘
```

**6. Alice Can Log In**
- Alice receives credentials from payer
- Opens WiFi login portal (login.html)
- Enters username: `Alice`
- Enters password: `AlicePass123`
- Gets internet access for 24 hours ✅

### Gift Recipient Reactivation Example

**Scenario**: Alice's previous gift expired 5 days ago
```json
Alice's current status:
{
  "_id": "...",
  "username": "Alice",
  "isActive": false,
  "sessionExpiry": "2026-03-27T18:30:00Z"
}
```

**When new gift is sent to Alice**:
```
1. System detects: needsReactivation = true (isActive is false)
2. Logs: "Gift recipient Alice needs reactivation"
3. Updates status:
   - isActive: true
   - sessionExpiry: 2026-04-02T18:30:00Z (new 24h window)
4. MikroTik hotspot profile updated
5. Alice can log in immediately ✅
6. Activity log shows: "Gift: Reactivation: Payment processed"
```

---

## 🔄 User Reactivation System

### Reactivation Flow

**When User's Session Expires**:
```
T+0h   → User logs in, isActive: true
T+24h  → Session expires, isActive: false
         User cannot connect
```

**When Expired User Buys New Bundle**:
```
1. Payment Initiated
2. Fapshi Webhook: Status = SUCCESSFUL
3. Backend activates:
   - Checks isActive status → false
   - Sets needsReactivation: true
   - Updates isActive: true
   - Sets new sessionExpiry
   - MikroTik profile updated
4. Returns message: "User reactivated - ready for silent login"
5. User can reconnect immediately ✅
```

### Reactivation Indicators in Logs

```
✅ First-time activation:
   "📝 User activation status: New user or extending active session"

✅ Reactivation of expired user:
   "🔄 USER NEEDS REACTIVATION: john_doe was deactivated, reactivating..."

✅ Activity log entry:
   "Reactivation: Payment of 1000 CFA processed successfully for 24h Plan (24h)"
   wasReactivation: true
```

---

## 💬 Email Validation & Sanitization

### Email Handling

**Problem Addressed**: 
- Invalid email formats caused Fapshi rejections
- Leading/trailing whitespace not handled
- Special character issues

**Solution Implemented**:
```typescript
// For phone-based payments:
email = `${phoneNumber}@splendidstarlink.com`

// Sanitization applied:
1. Trim whitespace
2. Convert to lowercase
3. Remove invalid characters
4. Validate format (RFC 5322 compliant)
5. Max length validation (254 chars)
6. Duplicate check in database

// Examples:
"  237123456789 @splendidstarlink.com  " 
→ "237123456789@splendidstarlink.com" ✅

"  INVALID @EMAIL  "
→ Error: Invalid email format ❌
```

### Testing Email Validation

```bash
# Valid payment (correct format)
curl -X POST http://localhost:3001/payments/initiate \
  -d '{
    "phone": "237123456789",
    "email": "user@example.com"
  }'

# Email auto-generated from phone
curl -X POST http://localhost:3001/payments/initiate \
  -d '{
    "phone": "237123456789"
  }'
# → email = "237123456789@splendidstarlink.com"

# Invalid email rejected
curl -X POST http://localhost:3001/payments/initiate \
  -d '{
    "email": "bad@@email"
  }'
# → 400 Bad Request: Invalid email format
```

---

## 📋 Billing API Endpoints

### 1. Get Billing History
- **Path**: `GET /user/billing`
- **Auth**: Required (Bearer JWT)
- **Description**: Retrieve complete invoice history with plan details
- **Response**: BillingHistoryResponseDto

```json
{
  "totalInvoices": 5,
  "totalAmountSpent": 5000,
  "invoices": [
    {
      "id": "pay_123",
      "planName": "24h Plan",
      "amount": 1000,
      "status": "SUCCESSFUL",
      "purchaseDate": "2026-04-01T18:30:00Z",
      "isGift": false,
      "recipientUsername": null,
      "activeRouter": "Home"
    },
    {
      "id": "pay_456", 
      "planName": "24h Plan",
      "amount": 1000,
      "status": "SUCCESSFUL",
      "purchaseDate": "2026-03-30T15:45:00Z",
      "isGift": true,
      "recipientUsername": "Alice",
      "activeRouter": "Home"
    }
  ]
}
```

### 2. Get Billing Statistics
- **Path**: `GET /user/billing/stats`
- **Auth**: Required (Bearer JWT)
- **Description**: Get aggregated billing statistics
- **Response**: BillingStatsDto

```json
{
  "totalPurchases": 5,
  "totalSpent": 5000,
  "totalHoursPurchased": 120,
  "successfulPayments": 4,
  "failedPayments": 1,
  "giftsReceived": 0,
  "giftsSent": 2,
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-04-02T00:00:00Z"
}
```

---

## 📊 Metrics API Endpoints

### 1. Get Current Metrics
- **Path**: `GET /connection/metrics`
- **Auth**: Required (Bearer JWT)
- **Description**: Get real-time connection speed, latency, and signal strength
- **Response**: ConnectionMetricsResponseDto

```json
{
  "isConnected": true,
  "metrics": {
    "downloadSpeed": 85.5,
    "uploadSpeed": 42.3,
    "latency": 25,
    "signalStrength": 98,
    "connectionQuality": "good",
    "timestamp": "2026-04-02T10:30:00Z"
  },
  "status": "active",
  "dataUsed": 1234567890,
  "sessionExpiry": "2026-04-02T18:30:00Z",
  "router": "Home"
}
```

### 2. Get Historical Metrics
- **Path**: `GET /connection/metrics/history`
- **Auth**: Required (Bearer JWT)
- **Query Params**: 
  - `hours` (optional, default: 24, max: 168)
- **Description**: Get historical metrics data with averages
- **Response**: HistoricalMetricsDto

```json
{
  "measurements": [...],
  "averageDownloadSpeed": 78.3,
  "averageUploadSpeed": 39.8,
  "averageLatency": 28.5,
  "averageSignalStrength": 95.2,
  "startTime": "2026-04-01T10:30:00Z",
  "endTime": "2026-04-02T10:30:00Z"
}
```

---

## 🎯 Payment Success Page

### Auto-Redirect Flow

**Timeline**:
```
T+0s  → Payment confirmed, redirect shown (1 second)
T+1s  → Redirect to /payment-success page
T+1s  → Success page displays with countdown
T+1-5s → Auto-redirect countdown (5 seconds)
T+6s  → Auto-redirect to WiFi login portal
        OR user clicks "Go to WiFi Login Portal" button
```

### Success Page Components

```
┌─────────────────────────────────────────┐
│  Header: Green gradient success theme   │
│  Icon: Large animated checkmark         │
├─────────────────────────────────────────┤
│  Title: "Payment Successful!"           │
│  Message: Based on payment type         │
│           (self-purchase vs gift)       │
├─────────────────────────────────────────┤
│  Session Details Section:               │
│  ├─ Username                           │
│  ├─ Duration (e.g., "24 hours")        │
│  └─ Plan type indicator                │
├─────────────────────────────────────────┤
│  Instructions: What to do next          │
│  ├─ Step 1: Connect to WiFi            │
│  ├─ Step 2: Click portal button        │
│  └─ Step 3: Log in                     │
├─────────────────────────────────────────┤
│  Auto-Redirect Countdown:               │
│  "Redirecting in 5 seconds..."          │
├─────────────────────────────────────────┤
│  Buttons:                               │
│  - Green: "Go to WiFi Login Portal"    │
│  - Gray: "Return to Dashboard"         │
└─────────────────────────────────────────┘
```

### Success Page URL
```
https://example.com/payment-success

Storage Keys Populated by PaymentStatusMonitor:
- wifiSessionUsername
- wifiSessionDuration
- wifiPaymentIsGift
- wifiPaymentRecipientUsername
```

---

## 🔐 Session Status Endpoints

### 1. Get Session Status
- **Path**: `GET /sessions/status`
- **Auth**: Required (Bearer JWT)
- **Description**: Get current session details and expiry info

```json
{
  "isActive": true,
  "remainingTime": 82800000,
  "remainingHours": 23.0,
  "sessionExpiry": "2026-04-02T18:30:00Z",
  "activeSessions": 1,
  "currentSession": {
    "startedAt": "2026-04-01T18:30:00Z",
    "router": "Home",
    "planDuration": 24
  }
}
```

---

## 📝 Activity Endpoints

### 1. Get Activity Log
- **Path**: `GET /activities`
- **Auth**: Required (Bearer JWT)
- **Description**: Get user activity audit trail

```json
[
  {
    "id": "act_123",
    "action": "payment_processed",
    "category": "payment",
    "description": "Gift: Reactivation: Payment of 1000 CFA processed successfully for 24h Plan (24h)",
    "status": "success",
    "timestamp": "2026-04-02T10:30:00Z",
    "metadata": {
      "planName": "24h Plan",
      "amount": 1000,
      "duration": 24,
      "isGift": true,
      "wasReactivation": true,
      "recipientUsername": "Alice"
    }
  }
]
```

---

## Testing Steps

1. **Start Backend Server**
   ```bash
   cd splendid-starlink
   npm install
   npm start:dev
   ```

2. **Check Swagger**
   - Go to `http://localhost:3001/docs`
   - All endpoints listed with examples

3. **Test Payment Flow**
   ```bash
   # 1. Initiate payment
   curl -X POST http://localhost:3001/payments/initiate \
     -H "Content-Type: application/json" \
     -d '{
       "planId": "507f1f77bcf86cd799439011",
       "phone": "237123456789",
       "email": "test@example.com"
     }'
   
   # Response contains: transId
   
   # 2. Check status
   curl http://localhost:3001/payments/status/{transId}
   ```

4. **Test Gift Purchase**
   ```bash
   curl -X POST http://localhost:3001/payments/initiate \
     -H "Content-Type: application/json" \
     -d '{
       "planId": "507f1f77bcf86cd799439011",
       "phone": "237123456789",
       "isGift": true,
       "recipientUsername": "Alice",
       "password": "AlicePass123"
     }'
   ```

---

## Notes
- All endpoints protected with JWT authentication (except public endpoints)
- Email validation prevents Fapshi rejections  
- Reactivation is automatic when expired users purchase new bundles
- Gift recipients can be new or existing (deactivated users reactivated)
- Success page auto-redirects to login portal after 5 seconds
- Gift and reactivation flags tracked in activity logs

