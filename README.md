# Multi-User Blog Application

A modern blog application built with Next.js, Auth.js, and GitHub integration. Users can create, edit, and manage blog posts through a web interface, with all content automatically committed to a GitHub repository.

## Features

- **User Authentication**: Email/password authentication using Auth.js
- **Web-based Editor**: Rich markdown editor for creating and editing posts
- **GitHub Integration**: All content is automatically stored in a GitHub repository
- **Bot Commits**: Users don't need GitHub accounts - a bot handles all commits
- **Responsive Design**: Modern, mobile-friendly UI built with Tailwind CSS
- **Real-time Preview**: Live preview of markdown content while editing
- **Post Management**: Create, edit, delete, and publish/unpublish posts

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Authentication**: Auth.js with credentials provider
- **Styling**: Tailwind CSS
- **Editor**: @uiw/react-md-editor
- **Storage**: GitHub API for content storage
- **Icons**: Lucide React

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ 
- A GitHub account
- A GitHub repository for storing blog content

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Auth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# GitHub Configuration (for bot commits)
GITHUB_TOKEN=your-github-token-here
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=your-blog-repo

# File storage
DATA_DIR=./data
```

### 3. GitHub Setup

1. Create a new GitHub repository for your blog content
2. Generate a Personal Access Token:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate a new token with `repo` permissions
   - Copy the token and add it to your `.env.local` file

3. Update the repository settings in `.env.local`:
   - `GITHUB_REPO_OWNER`: Your GitHub username
   - `GITHUB_REPO_NAME`: The name of your blog repository

### 4. Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### 5. First User Setup

1. Navigate to `http://localhost:3000`
2. Click "Create Account" to sign up
3. Create your first blog post using the editor

## How It Works

### Authentication
- Users sign up with email/password (no GitHub account required)
- User data is stored locally in JSON files
- Passwords are hashed using bcrypt

### Content Management
- All blog posts are stored as JSON files in the GitHub repository
- The bot automatically commits changes when users create/edit posts
- Posts are organized in a `posts/` directory in the repository

### GitHub Integration
- The application uses the GitHub API to read and write content
- A single bot account (configured via GitHub token) handles all commits
- Users interact only through the web interface

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   └── posts/         # Blog post CRUD endpoints
│   ├── auth/              # Sign in/up pages
│   ├── editor/            # Post editor pages
│   ├── posts/             # Post view pages
│   └── layout.tsx         # Root layout with providers
├── components/
│   └── providers.tsx      # Session provider wrapper
├── lib/
│   ├── auth.ts           # Auth.js configuration
│   ├── github.ts         # GitHub API service
│   └── markdown.ts       # Markdown rendering utilities
└── data/                 # Local user data storage
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/[...nextauth]` - NextAuth.js endpoints

### Blog Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post
- `GET /api/posts/[id]` - Get specific post
- `PUT /api/posts/[id]` - Update post
- `DELETE /api/posts/[id]` - Delete post

## Deployment

### Environment Variables for Production
Update your production environment variables:
- `NEXTAUTH_URL`: Your production domain
- `NEXTAUTH_SECRET`: A secure random string
- `GITHUB_TOKEN`: Your GitHub personal access token
- `GITHUB_REPO_OWNER`: Your GitHub username
- `GITHUB_REPO_NAME`: Your blog repository name

### Deploy to Vercel
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Usage

1. **Sign Up**: Create an account with your email and password
2. **Create Post**: Click "New Post" to create your first blog post
3. **Edit Post**: Use the markdown editor to write content with live preview
4. **Publish**: Toggle the "Publish immediately" checkbox to make posts public
5. **Manage Posts**: View, edit, or delete posts from the dashboard

## Security Notes

- User passwords are hashed using bcrypt
- GitHub tokens should be kept secure and not exposed
- The application uses JWT for session management
- All API routes are protected with authentication

## Troubleshooting

### Common Issues

1. **GitHub API Errors**: Ensure your token has the correct permissions
2. **Authentication Issues**: Check that `NEXTAUTH_SECRET` is set
3. **Build Errors**: Make sure all dependencies are installed

### Getting Help

If you encounter issues:
1. Check the browser console for errors
2. Verify your environment variables
3. Ensure your GitHub repository exists and is accessible

## Contributing

This is a demo application. Feel free to fork and modify for your own use!

## License

MIT License - feel free to use this project for your own blog.