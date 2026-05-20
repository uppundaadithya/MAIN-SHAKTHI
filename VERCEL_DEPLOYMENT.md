# Vercel Deployment Guide - SHAKTHI

## Prerequisites
- A Vercel account (free at https://vercel.com)
- Git repository connected to Vercel

## Deployment Steps

### 1. Prepare Your Project
The project is now configured for Vercel deployment:
- ✅ `vercel.json` - Vercel configuration file
- ✅ `package.json` - Proper Node.js dependencies
- ✅ `server.js` - Vercel-compatible Express server
- ✅ `.env.example` - Environment variables template

### 2. Set Environment Variables on Vercel
Go to your Vercel project dashboard and add these environment variables:

```
NODE_ENV=production
EMERGENCY_CONTACT=7624989627
```

### 3. Deploy Options

#### Option A: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel deploy
```

#### Option B: Deploy via Git
1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Select this project and click "Deploy"
4. Vercel will automatically detect the configuration and deploy

#### Option C: Deploy via Web Interface
1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. Configure environment variables
5. Click "Deploy"

### 4. Verify Deployment
After deployment, your app will be available at:
- Main app: `https://your-vercel-url.vercel.app`
- API status: `https://your-vercel-url.vercel.app/api/status`
- User portal: `https://your-vercel-url.vercel.app/user`
- Admin panel: `https://your-vercel-url.vercel.app/admin`

### 5. Project Structure
```
/back
  ├── server.js (Express server - entry point)
  ├── package.json (Dependencies)
  ├── vercel.json (Vercel configuration)
  ├── .env (Local environment variables)
  └── .env.example (Template)

/front
  ├── login.html
  ├── admin/
  ├── user/
  └── api/
```

### 6. Important Notes
- Static files from `/front` are served by the Express server
- The `NODE_ENV` environment variable is automatically set to `production` on Vercel
- Maximum lambda size is set to 50MB
- Node.js version: 20.x

### 7. Troubleshooting
If deployment fails:
1. Check build logs in Vercel dashboard
2. Verify all environment variables are set
3. Ensure `server.js` exports the Express app: `module.exports = app;`
4. Check that `package.json` has all required dependencies

### 8. Updating Your Deployment
Simply push changes to your GitHub repository. Vercel will automatically rebuild and deploy.

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

## Key Configuration Files

### vercel.json
Specifies how Vercel builds and deploys your application. Currently configured to:
- Use Node.js runtime
- Build from `server.js`
- Route all requests to the Express server
- Set production environment variables

### package.json
Contains:
- Express 4.18.2
- CORS middleware
- Build script for Vercel
- Node.js 20.x compatibility

## Support
For issues with Vercel deployment, visit: https://vercel.com/docs
