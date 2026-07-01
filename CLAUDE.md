# BitzSol Lead Management CRM

## Project Overview
A lead management CRM with pipelines, leads, and user role management.
Built for BitzSol (https://bitzsol.com).

## Tech Stack
- **Frontend:** Next.js 14+ (App Router), Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase + Prisma ORM
- **Authentication:** Supabase Auth
- **Notifications:** Discord Webhooks

## User Roles

### Admin
- Full access to everything
- Can create, edit, and delete users
- Can create and delete pipelines
- Can create and delete leads
- Can see all stats and per-user stats on dashboard

### Business Developer
- Can create leads (cannot delete them)
- Cannot access or manage users
- Can only see their own leads and stats on dashboard

## Authentication Rules
- Sessions expire daily — users must log in fresh each day
- On login: send Discord notification with user status
- On logout: send Discord notification with user status

## Modules & CRUDs

### 1. Users
- Fields: name, email, password, role (admin | business_developer), status
- Only admins can create, edit, delete users
- Admins can toggle user active/inactive status

### 2. Pipelines
- Fields: name, description, created_by, created_at
- Only admins can create and delete pipelines

### 3. Leads
- Belongs to a pipeline and a user (created_by)
- Only admins can delete leads
- Business developers can create and edit their own leads

#### Lead Fields:
- First Name
- Middle Name
- Last Name
- Date
- Designation
- Lead Source (dropdown — users can add custom options via + button)
- Email (multiple entries, each with status: Verified / Not Verified)
- Phone (multiple entries, each with status: Verified / Not Verified)
- Status (dropdown — users can add custom options via + button)
- Source Link
- User (Created By — auto-filled)
- Remarks (rich text editor)
- Custom Fields (users can add their own fields to a lead)

## Discord Notifications
- Trigger on: new lead created, user login, user logout
- Use Discord Webhook URL stored in environment variables
- Message should include: user name, action, timestamp

## Dashboard

### Stats Shown:
- Active leads grouped by status
- Leads created this week / this month / this year (toggle)
- Admins see: global stats + per business developer breakdown
- Business developers see: only their own stats

## UI/UX

### Branding
- Logo: https://bitzsol.com/logo-light.svg
- Primary Colors: #FB66BC, #03D9AF, #0164DA
- Neutrals: #000000, #FFFFFF
- Always use brand colors consistently across components

### Layout
**Sidebar:**
- Logo (top)
- Dashboard
- Users (admin only)
- Pipelines
- Leads
- Logout (bottom)

**Header:**
- Profile Settings
- Theme Toggle (dark/light)
- Logout

**Footer:**
- Copyright © bitzsol.com

### Sign In Page
- Clean minimal layout
- Fields: Username & Password
- Brand-styled submit button

### Tables (All List Views)
- Toggle columns on/off
- Pagination, sorting, and search
- Inline status change per row
- Edit icon opens edit form/modal
- Delete (admin only) with confirmation prompt

## Coding Style
- ES6+ syntax throughout
- Always handle errors with try/catch and meaningful messages
- Use async/await (no callbacks)
- Keep components small and reusable
- Use Prisma for all DB queries (no raw SQL unless necessary)
- Protect all API routes with role-based middleware

## Project Structure
/src
  /app             → Next.js App Router pages and API routes
  /components      → Reusable UI components
  /lib             → Supabase client, Prisma client, helpers
  /hooks           → Custom React hooks
  /types           → TypeScript types and interfaces
  /styles          → Global styles
/prisma
  schema.prisma    → Database schema
/docs              → Project documentation
/tests             → Test files

## Environment Variables (never hardcode these)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL
- DISCORD_WEBHOOK_URL
- NEXTAUTH_SECRET (if needed)

## Important Rules
- Never commit .env files
- Always validate user roles on the server side (not just frontend)
- Maintain consistent branding and theme across all pages
- Mobile responsive design required
- Use TypeScript strictly — no `any` types