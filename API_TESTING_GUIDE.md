# API Testing Guide

## Swagger Documentation
All new endpoints are fully documented and ready to test in Swagger:
- **URL**: `http://localhost:3000/docs`

---

## 📋 Billing API Endpoints

### 1. Get Billing History
- **Path**: `GET /user/billing`
- **Auth**: Required (Bearer JWT)
- **Description**: Retrieve complete invoice history with plan details
- **Response**: BillingHistoryResponseDto

### 2. Get Billing Statistics
- **Path**: `GET /user/billing/stats`
- **Auth**: Required (Bearer JWT)
- **Description**: Get aggregated billing statistics
- **Response**: BillingStatsDto

**Example Stats Response:**
```json
{
  "totalPurchases": 5,
  "totalSpent": 15000,
  "totalHoursPurchased": 120,
  "successfulPayments": 4,
  "failedPayments": 1,
  "giftsReceived": 0,
  "startDate": "2025-01-15T10:30:00Z",
  "endDate": "2025-03-15T10:30:00Z"
}
```

---

## 📊 Metrics API Endpoints

### 1. Get Current Metrics
- **Path**: `GET /connection/metrics`
- **Auth**: Required (Bearer JWT)
- **Description**: Get real-time connection speed, latency, and signal strength
- **Response**: ConnectionMetricsResponseDto

### 2. Get Historical Metrics
- **Path**: `GET /connection/metrics/history`
- **Auth**: Required (Bearer JWT)
- **Query Params**: 
  - `hours` (optional, default: 24, max: 168) - Time period in hours
- **Description**: Get historical metrics data with averages
- **Response**: HistoricalMetricsDto

**Example Metrics Response:**
```json
{
  "isConnected": true,
  "metrics": {
    "downloadSpeed": 85.5,
    "uploadSpeed": 42.3,
    "latency": 25,
    "signalStrength": 98,
    "connectionQuality": "good",
    "timestamp": "2025-03-15T10:30:00Z"
  },
  "status": "active",
  "dataUsed": 1234567890,
  "sessionExpiry": "2025-03-15T18:30:00Z",
  "router": "Home"
}
```

---

## Testing Steps

1. **Start Backend Server**
   ```bash
   cd backend
   npm install  # if needed
   npm start
   ```

2. **Login to Get JWT Token**
   - Go to Swagger: `http://localhost:3000/docs`
   - Use `POST /auth/login` endpoint
   - Copy the JWT token from response

3. **Authorize in Swagger**
   - Click "Authorize" button
   - Paste JWT token with "Bearer " prefix
   - All endpoints are now authenticated

4. **Test Billing Endpoints**
   - Expand "Billing" section
   - Click "GET /user/billing" → "Try it out" → "Execute"
   - Click "GET /user/billing/stats" → "Try it out" → "Execute"

5. **Test Metrics Endpoints**
   - Expand "Metrics" section
   - Click "GET /connection/metrics" → "Try it out" → "Execute"
   - Click "GET /connection/metrics/history" → "Try it out" → "Execute"
   - (Optional) Add `hours=48` query parameter for last 48 hours

---

## Response Details

### BillingHistoryResponseDto Includes:
- `totalInvoices` - Number of payments
- `totalAmountSpent` - Total CFA spent
- `invoices[]` - Array of InvoiceDto:
  - `id` - Payment/Invoice ID
  - `planName` - Plan name
  - `amount` - Amount in CFA
  - `duration` - Duration in hours
  - `purchaseDate` - When purchased
  - `status` - Payment status (SUCCESSFUL/FAILED/PENDING/EXPIRED)
  - `transactionId` - Fapshi transaction ID
  - `email` - Email used for payment
  - `phone` - Phone used for payment
  - `isGift` - Whether this was a gift
  - `recipientUsername` - Recipient if gift
  - `activeRouter` - Router where active

### MetricsDto Includes:
- `downloadSpeed` - Mbps
- `uploadSpeed` - Mbps
- `latency` - Milliseconds
- `signalStrength` - 0-100%
- `connectionQuality` - excellent/good/fair/poor
- `timestamp` - When measured

### HistoricalMetricsDto Includes:
- `measurements[]` - Array of MetricsDto
- `averageDownloadSpeed` - Average over period
- `averageUploadSpeed` - Average over period
- `averageLatency` - Average over period
- `averageSignalStrength` - Average over period
- `startTime` - Period start
- `endTime` - Period end

---

## Notes
- All endpoints are protected with JWT authentication
- Metrics returns realistic mock data if no active session or router is unreachable
- Historical metrics generates data points at 30-minute intervals
- Gift purchases are tracked separately in billing history
- Connection quality is automatically calculated from latency
