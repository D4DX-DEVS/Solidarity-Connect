# CORS Fix Deployment Guide

## Issue
Frontend at `https://octopus-app-zv6rt.ondigitalocean.app` was getting **405 Method Not Allowed** error when trying to access API endpoints due to CORS (Cross-Origin Resource Sharing) restrictions.

## Root Cause
The API server's CORS configuration was only allowing `https://your-frontend-domain.com` in production, but the actual frontend is deployed at `https://octopus-app-zv6rt.ondigitalocean.app`.

## Solution Applied

### 1. Updated CORS Configuration (`solidarity-api/src/server.js`)

#### Before:
```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081'],
  credentials: true
}));
```

#### After:
```javascript
// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://octopus-app-zv6rt.ondigitalocean.app',
      process.env.FRONTEND_URL || 'https://your-frontend-domain.com'
    ]
  : [
      'http://localhost:3000', 
      'http://localhost:5173', 
      'http://localhost:8080', 
      'http://localhost:8081',
      process.env.FRONTEND_URL
    ].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 2. Added Environment Variable Support

#### Updated `.env` file:
```env
# Frontend Configuration
FRONTEND_URL=https://octopus-app-zv6rt.ondigitalocean.app
```

#### Created `.env.production` template:
```env
NODE_ENV=production
FRONTEND_URL=https://octopus-app-zv6rt.ondigitalocean.app
DXING_MOCK_MODE=false
```

### 3. Enhanced CORS Configuration Features

- **Dynamic Origin Checking**: Function-based origin validation
- **Better Logging**: Console logs for blocked origins
- **Method Support**: Explicit support for all required HTTP methods
- **Header Support**: Proper Content-Type and Authorization headers
- **Credentials**: Enabled for authentication cookies/tokens

## Deployment Steps

### For Production Server:

1. **Update Environment Variables**:
   ```bash
   # Set NODE_ENV to production
   export NODE_ENV=production
   
   # Set frontend URL
   export FRONTEND_URL=https://octopus-app-zv6rt.ondigitalocean.app
   ```

2. **Restart API Server**:
   ```bash
   # Stop current server
   pm2 stop solidarity-api
   
   # Start with new configuration
   pm2 start solidarity-api
   
   # Or restart
   pm2 restart solidarity-api
   ```

3. **Verify CORS Configuration**:
   ```bash
   # Check server logs for CORS origins
   pm2 logs solidarity-api
   
   # Should show:
   # 🌐 CORS allowed origins: ['https://octopus-app-zv6rt.ondigitalocean.app']
   # 🔧 Environment: production
   ```

### For DigitalOcean App Platform:

1. **Update Environment Variables** in App Settings:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://octopus-app-zv6rt.ondigitalocean.app`

2. **Redeploy the API** to apply changes

3. **Test API Endpoints** from frontend

## Testing

### 1. Test CORS from Browser Console:
```javascript
fetch('https://your-api-domain.com/api/auth/send-otp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ phone: '1234567890' })
})
.then(response => console.log('Success:', response))
.catch(error => console.log('Error:', error));
```

### 2. Check Network Tab:
- **Before Fix**: 405 Method Not Allowed
- **After Fix**: 200 OK or appropriate response

### 3. Verify CORS Headers:
Look for these headers in response:
```
Access-Control-Allow-Origin: https://octopus-app-zv6rt.ondigitalocean.app
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

## Common Issues & Solutions

### Issue 1: Still Getting CORS Error
**Solution**: Ensure `NODE_ENV=production` is set in production environment

### Issue 2: OPTIONS Preflight Failing
**Solution**: Verify `OPTIONS` method is included in allowed methods

### Issue 3: Credentials Not Working
**Solution**: Ensure both frontend and backend have `credentials: true`

### Issue 4: Multiple Domains Needed
**Solution**: Add more domains to the `allowedOrigins` array

## Environment-Specific Configuration

### Development:
```javascript
// Allows localhost ports + any FRONTEND_URL
allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', 
  'http://localhost:8080',
  'http://localhost:8081',
  process.env.FRONTEND_URL
]
```

### Production:
```javascript
// Only allows production domains
allowedOrigins = [
  'https://octopus-app-zv6rt.ondigitalocean.app',
  process.env.FRONTEND_URL
]
```

## Security Considerations

1. **Specific Origins**: Only allow trusted domains
2. **Credentials**: Only enable if needed for authentication
3. **Methods**: Only allow required HTTP methods
4. **Headers**: Restrict to necessary headers
5. **Environment Variables**: Use for flexible configuration

## Monitoring

### Server Logs to Watch:
```bash
# Successful CORS
🌐 CORS allowed origins: ['https://octopus-app-zv6rt.ondigitalocean.app']

# Blocked requests
❌ CORS blocked origin: https://malicious-site.com
```

### Frontend Network Tab:
- Check for proper CORS headers in responses
- Verify no preflight failures
- Confirm credentials are sent when needed

## Conclusion

This CORS fix ensures that:
- ✅ Frontend can access API endpoints
- ✅ Authentication works properly
- ✅ All HTTP methods are supported
- ✅ Configuration is environment-aware
- ✅ Security is maintained with specific origin restrictions

The API should now properly handle requests from `https://octopus-app-zv6rt.ondigitalocean.app` without CORS errors.