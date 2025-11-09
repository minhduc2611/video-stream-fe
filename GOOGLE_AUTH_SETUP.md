# Google Authentication Setup Guide

## 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API and Google Identity Services
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure the OAuth consent screen if prompted
6. Set up the OAuth 2.0 Client ID:
   - **Application type**: Web application
   - **Name**: Video Stream App (or your preferred name)
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - **Authorized redirect URIs**: 
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)

## 2. Environment Variables

Create a `.env.local` file in the frontend directory with:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1

# Google Authentication
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
```

For the backend, add to your `.env` file:

```bash
# Google Authentication
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

## 3. Features Implemented

### Backend Features:
- ✅ Google token verification endpoint (`POST /api/v1/auth/google`)
- ✅ Automatic user creation from Google profile
- ✅ JWT token generation for authenticated users
- ✅ Integration with existing user system

### Frontend Features:
- ✅ Google Sign-In button component
- ✅ Integration with authentication context
- ✅ Updated sign-in and sign-up pages
- ✅ Error handling and loading states

## 4. Usage

### Sign In with Google:
1. User clicks the "Continue with Google" button
2. Google authentication popup appears
3. User selects their Google account
4. Backend verifies the Google token
5. User is automatically logged in and redirected to dashboard

### Sign Up with Google:
1. User clicks the "Sign up with Google" button
2. Google authentication popup appears
3. User selects their Google account
4. Backend creates a new user account automatically
5. User is logged in and redirected to dashboard

## 5. Security Features

- ✅ Server-side token verification
- ✅ Automatic user creation with secure random passwords
- ✅ JWT token generation for session management
- ✅ CORS protection
- ✅ Input validation

## 6. Testing

1. Start the backend server: `cargo run`
2. Start the frontend: `npm run dev`
3. Navigate to `http://localhost:3000/sign-in`
4. Click "Continue with Google"
5. Complete the Google authentication flow

## 7. Troubleshooting

### Common Issues:

1. **"Invalid Google token" error**:
   - Check that `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set correctly
   - Verify the Google Cloud Console configuration
   - Ensure the domain is authorized in Google Cloud Console

2. **CORS errors**:
   - Check that the backend CORS configuration includes your frontend URL
   - Verify the `ALLOWED_ORIGINS` environment variable

3. **"Google sign-in failed" error**:
   - Check browser console for detailed error messages
   - Verify the Google Identity Services script is loading
   - Ensure the client ID is valid and active

### Debug Steps:

1. Check browser developer tools console for errors
2. Verify environment variables are loaded correctly
3. Test the backend Google auth endpoint directly
4. Check Google Cloud Console for any restrictions or issues
