# Genesis Base Template v2 - AI Development Guide

## Core Rules

1. **Work ONLY in `src/`** - Create/modify files only under `src/`, never touch files outside
2. **Don't modify `src/main.tsx`** - Entry point is fixed
3. **Start with `src/App.tsx`** - Root component of the application
4. **Use `@/` imports** - `import { cn } from '@/lib/utils'` not relative paths

## File Structure

```
src/
├── App.tsx              # Root component (start here)
├── main.tsx             # Entry point (don't modify)
├── index.css            # Tailwind + CSS variables
├── components/ui/       # UI components (Switch, etc.)
└── lib/utils.ts         # cn() utility
```

## Available Dependencies

### Core
- react 18.3, react-dom 18.3, typescript 5.4, tailwindcss 3.4

### UI & Styling
- **@radix-ui/react-*** - Dialog, Dropdown Menu, Select, Switch, Tabs, Tooltip, Progress, Separator
- **lucide-react** 0.542 - Icons (1000+ available)
- **framer-motion** 12.9 - Animations
- **next-themes** 0.4 - Dark mode
- **tailwind-merge** + **clsx** - `cn()` utility
- **class-variance-authority** 0.7 - Variant styling
- **@radix-ui/colors** 3.0 - Color system

### Forms & Validation
- **react-hook-form** 7.54 + **@hookform/resolvers** 3.4
- **zod** 3.25 - Schema validation

### State & Routing  
- **zustand** 4.5 - State management
- **react-router-dom** 6.30 - Routing
- **react-oidc-context** 3.3 - OIDC auth client
- **axios** 1.12 - HTTP client

### UI Components
- **cmdk** 1.1 - Command palette
- **sonner** 2.0 - Toasts
- **@hello-pangea/dnd** 18.0 - Drag & drop
- **@formkit/auto-animate** 0.8 - Auto animations
- **react-textarea-autosize** 8.5 - Auto-growing textarea
- **react-intersection-observer** 9.16 - Visibility detection
- **react-error-boundary** 5.0 - Error boundaries

### Content & Data
- **react-markdown** 10.1 + **remark-gfm** 4.0 - Markdown
- **recharts** 2.15 - Charts
- **date-fns** 4.1 - Date utilities

## Authentication (OIDC)

If the user asks for auth/login/signup/protected access, implement OIDC with `react-oidc-context`.
Do not build custom authentication flows unless the user explicitly asks for a non-OIDC solution.

Defaults:
- Discovery URL: `/_genesis/auth/realms/{spaceId}/.well-known/openid-configuration`
- Authority: `/_genesis/auth/realms/{spaceId}`
- Client ID: `{appId}` (currently `default`)
- Scope: `openid profile email`
- Response type: `code`

If the app needs user profile data (email/name/username), call `userinfo_endpoint` with the access token.

Example config:
```ts
const oidcConfig = {
  authority: `${window.location.origin}/_genesis/auth/realms/${SPACE_ID}`,
  client_id: APP_ID,
  redirect_uri: `${window.location.origin}/oidc/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
};
```

## Pre-built Components

**Switch** - `import { Switch } from '@/components/ui/switch'`

Create custom components freely in `src/components/` using Radix UI primitives.

## CSS Design System

Use semantic color classes (automatically supports light/dark mode):

- `bg-background text-foreground` - Page default
- `bg-primary text-primary-foreground` - Primary buttons
- `bg-secondary text-secondary-foreground` - Secondary elements
- `bg-muted text-muted-foreground` - Disabled/subtle
- `bg-accent text-accent-foreground` - Highlights
- `bg-destructive text-destructive-foreground` - Delete/error
- `bg-card text-card-foreground` - Cards
- `border-border` - Borders
- `ring-ring` - Focus rings

## Component Patterns

### TypeScript
- Define explicit Props interfaces for all components
- Use `React.FC<Props>` and function declarations
- Use Zod schemas with `z.infer<typeof schema>` for form types

### Styling
- Use Tailwind utility classes
- Use `cn()` from `@/lib/utils` for conditional classes
- Use semantic color classes for theme consistency

### File Organization
- `src/components/` - Reusable components
- `src/pages/` - Route pages
- `src/hooks/` - Custom hooks
- `src/stores/` - Zustand stores
- `src/lib/` - Utilities

## Key Libraries Usage

### Routing
- Use `react-router-dom` with `BrowserRouter`, `Routes`, `Route`

### State Management
- Use `zustand` with `create<State>()` for global state

### Forms
- Use `react-hook-form` with `useForm()` and `zodResolver()` for validation

### Icons
- Import from `lucide-react`: `import { Home, User, Settings } from 'lucide-react'`

### Dark Mode
- Use `next-themes` with `ThemeProvider` and `useTheme()` hook

### HTTP
- Use `axios` for API calls

## Summary

React 18 + TypeScript + Tailwind CSS template. Work only in `src/`. Use Radix UI primitives for accessible components, Zustand for state, React Router for routing, react-hook-form + Zod for forms, Lucide for icons. Build custom components as needed.
