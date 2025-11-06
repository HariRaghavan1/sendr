# Sendr - AI Email Outreach Platform

Sendr is an AI-powered email outreach and campaign management platform that helps you create, manage, and automate personalized email campaigns with intelligent prospect targeting.

## Features

- **AI-Powered Campaign Creation**: Conversational interface to build campaigns through chat
- **Campaign Management**: Create, monitor, and manage multiple email outreach campaigns
- **Real-time Execution Tracking**: Live monitoring of campaign execution with Supabase subscriptions
- **Prospect Management**: Store and track prospects linked to campaigns
- **Smart Scheduling**: Configure frequency and batch sizes for automated sending
- **User Authentication**: Secure email/password authentication with Supabase
- **Settings Management**: Store and manage API keys for third-party integrations (Clado, Composio)
- **Dark Theme**: Modern ChatGPT-inspired dark UI with orange accents

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui (51 components) + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **State Management**: TanStack React Query + React Hook Form
- **Routing**: React Router v6
- **Validation**: Zod schemas
- **Icons**: Lucide React
- **Charts**: Recharts

## Prerequisites

- Node.js 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm or bun
- A Supabase account and project

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

**Important**: Never commit the `.env` file to version control. It's already in `.gitignore`.

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd scratch-forge-art

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at http://localhost:8080

## Available Scripts

```bash
npm run dev          # Start development server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components (51 files)
│   ├── AppSidebar.tsx  # Main navigation
│   ├── ErrorBoundary.tsx # Error handling
│   ├── ProtectedRoute.tsx # Auth wrapper
│   └── ...             # Other components
├── pages/              # Page components
│   ├── Auth.tsx        # Sign in/Sign up
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Settings.tsx    # User settings
│   ├── Workflows.tsx   # Campaign list
│   ├── CampaignCreate.tsx # Manual campaign creation
│   ├── ConversationView.tsx # AI campaign builder
│   └── CampaignDetail.tsx # Campaign details
├── hooks/              # Custom React hooks
│   ├── useConversation.ts # Conversation state management
│   └── useRealtimeExecution.ts # Real-time tracking
├── integrations/       # External integrations
│   └── supabase/       # Supabase client & types
├── lib/                # Utilities
├── App.tsx             # Root component
└── main.tsx            # Entry point
```

## Database Schema

Key tables in Supabase:

- `campaigns` - Campaign records
- `campaign_conversations` - AI conversation history
- `conversation_messages` - Individual messages
- `campaign_executions` - Execution tracking
- `workflow_executions` - Workflow-specific executions
- `prospects` - Prospect records
- `user_settings` - Per-user configuration

## Key Features & Usage

### Creating a Campaign

1. **AI-Assisted**: Click "Create Campaign" → Chat with AI to describe your campaign
2. **Manual**: Click "Manual Campaign" → Fill out the form with campaign details

### Managing Campaigns

- View all campaigns in the Workflows page
- Click on a campaign to view details and prospects
- Monitor execution status in real-time
- Start test runs before full deployment

### Settings

Configure your API keys in Settings:
- **Clado API Key**: For B2B lead discovery
- **Composio API Key**: For email sending via Gmail/Outlook

## Security Best Practices

- Never commit `.env` files
- API keys are stored securely in Supabase
- All routes except `/auth` require authentication
- Session persistence with localStorage
- Auto-refresh tokens handled by Supabase

## Development

### Code Quality

- TypeScript for type safety
- ESLint for code linting
- React Query for server state management
- Error boundaries for graceful error handling

### Component Architecture

- Reusable UI components from shadcn/ui
- Custom hooks for complex logic
- Protected routes with auth guards
- Real-time subscriptions for live updates

## Deployment

### Via Lovable Platform

1. Visit [Lovable](https://lovable.dev/projects/63693753-e853-40fd-a5ae-0c91d0440c52)
2. Click Share → Publish

### Manual Deployment

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting platform
3. Ensure environment variables are set in your hosting platform
4. Configure Supabase URL redirect in your project settings

## Custom Domain

To connect a custom domain via Lovable:
1. Navigate to Project > Settings > Domains
2. Click Connect Domain
3. Follow the instructions

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Troubleshooting

### Development Server Won't Start

- Ensure Node.js 18+ is installed
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check if port 8080 is available

### Environment Variables Not Working

- Ensure `.env` file exists in root directory
- Verify all variables start with `VITE_`
- Restart the development server after changes

### Supabase Connection Issues

- Verify Supabase credentials in `.env`
- Check Supabase project status
- Ensure RLS policies are configured correctly

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Contact the maintainers

## Acknowledgments

- Built with [Lovable](https://lovable.dev)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Backend powered by [Supabase](https://supabase.com)
