# Timeline App

A modern, responsive timeline application built with Next.js 15, TypeScript, and Tailwind CSS. Track and visualize the important moments of your life with rich media support, categorization, and a beautiful vertical timeline interface.

## Features

### Authentication
- **Email/Password Authentication** - Secure sign up and sign in
- **OTP Verification** - Mock OTP verification for enhanced security (development mode)
- **Google OAuth Integration** - Ready for Google sign-in (configure with your credentials)
- **Multi-user Support** - Each user has their own private timeline

### Timeline & Events
- **Vertical Timeline View** - Mobile-first, scrollable timeline optimized for portrait mode
- **Main Events** - Create events with date ranges (from/to dates)
- **Sub-Events** - Add detailed sub-events with single dates under main events
- **Rich Text Editor** - Format your event descriptions with bold, italic, headings, lists, quotes, and more
- **Categories** - Organize events with customizable categories (color-coded with icons)
- **Search & Filter** - Quickly find events by title, description, or category

### Media Support
- **Image Uploads** - Add multiple images to events and sub-events
- **YouTube Embeds** - Embed YouTube videos directly in your events
- **Configurable Limits** - Set max file sizes and upload limits in settings
- **Image Preview** - View uploaded images before saving

### Data Storage
- **LocalStorage** - All data stored in browser localStorage (no server required)
- **API-Ready Architecture** - Clean service layer designed for easy backend integration
- **Persistent Sessions** - Your data stays with you across sessions

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Authentication**: NextAuth.js v5 (beta)
- **Rich Text Editor**: Tiptap
- **State Management**: Zustand
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **UI Components**: Custom shadcn/ui-inspired components

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

1. **Navigate to the project directory**:
   ```bash
   cd TimelineApp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Guide

### Getting Started

1. **Sign Up**
   - Click "Sign up" on the landing page
   - Enter your name, email, and password
   - You'll receive a mock OTP (displayed in an alert for development)
   - Enter the OTP to complete registration

2. **Create Your First Event**
   - Click the "New Event" button on the dashboard
   - Fill in the event details:
     - **Title**: Name of the event
     - **Category**: Choose from pre-defined categories
     - **Date From/To**: Set the date range for the event
     - **Description**: Add rich text description with formatting
     - **Media**: Upload images or add YouTube videos
     - **Sub-Events**: Add detailed sub-events if needed

3. **Manage Categories**
   - Navigate to "Categories" in the sidebar
   - View all available categories with their colors and icons
   - Delete categories you don't need

4. **Configure Settings**
   - Go to "Settings" to configure:
     - Max image upload size
     - Maximum images per event
     - Allowed image formats
     - YouTube embed permissions

## Default Categories

The app comes with 8 pre-defined categories:

1. **Travel** (Blue) - For trips and journeys
2. **Wedding** (Pink) - For weddings and engagements
3. **Career** (Purple) - For job changes and achievements
4. **Education** (Green) - For academic milestones
5. **Family** (Orange) - For family events
6. **Achievement** (Red) - For personal accomplishments
7. **Health** (Teal) - For health-related events
8. **Other** (Gray) - For miscellaneous events

## Future Enhancements

Features marked for future updates:

- **People Tagging**: Tag people in events, pictures, and videos
- **Doodles/Drawing**: Add freehand drawings to events
- **Privacy Controls**: Share timelines publicly or with specific people
- **Category Creation UI**: Full UI for creating custom categories
- **Advanced Filtering**: Filter by date ranges, multiple categories
- **Export/Import**: Export timeline data

## Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## License

This project is created for personal use.
