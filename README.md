# Portuguese Flashcard App

A modern spaced-repetition flashcard app for learning Portuguese vocabulary. Built with React, Vite, Firebase, and Google's Gemini API.

## Features

- **Spaced Repetition**: Words progress through boxes (0-4) based on your performance
- **Group Organization**: Organize vocabulary into custom groups
- **Daily AI Words**: Automatic daily Portuguese vocabulary generation via Gemini API
- **Study Modes**: Multiple directions (Portuguese→English, English→Portuguese, or random)
- **Progress Tracking**: Save your learning progress to Firebase
- **Mastered Words**: Track words you've fully learned
- **Edit & Delete**: Manage your word list with add, edit, and delete functionality

## Tech Stack

- **Frontend**: React 19 + Vite + React Icons
- **Backend**: Vercel serverless functions with scheduled crons
- **Database**: Firebase Firestore
- **AI**: Google Gemini API for vocabulary generation

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project
- Google Gemini API key

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file with your API keys (for local development):

```
GEMINI_API_KEY=your_gemini_api_key_here
```

For Vercel deployment, set these environment variables in your Vercel project settings.

### Development

```bash
npm run dev
```

Visit `http://localhost:5173`

### Build

```bash
npm run build
npm run preview
```

## Project Structure

- `src/App.jsx` - Main application component
- `src/firebase.js` - Firebase configuration
- `api/cron.js` - Daily word generation via Vercel cron
- `vite.config.js` - Vite configuration

## Security

- API keys are stored in environment variables (never committed to git)
- `.env` and `.env.local` are in `.gitignore`
- Use Vercel's environment variable management for production secrets
