# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npx expo start` — Start the Expo dev server
- `npx expo start --android` / `--ios` / `--web` — Start for a specific platform
- `npm run lint` (alias for `expo lint`) — Run ESLint (flat config with eslint-config-expo)
- No test runner is currently configured.

## Architecture

This is a React Native mobile app built with **Expo SDK 54** and **Expo Router v6** (file-based routing). It uses the React Native New Architecture and React Compiler (experimental).

### Routing

- `app/_layout.tsx` — Root layout: Stack navigator with ThemeProvider (light/dark), wraps a `(tabs)` group and a `modal` screen.
- `app/(tabs)/_layout.tsx` — Tab navigator with Home and Explore tabs, uses haptic feedback on tab press.
- `app/modal.tsx` — Modal screen presented over tabs.
- Typed routes are enabled (`experiments.typedRoutes` in app.json).

### Backend

- **Supabase** client configured in `lib/supabase.ts`, using `@react-native-async-storage/async-storage` for auth session persistence. `detectSessionInUrl` is disabled for mobile.

### Theming

- `constants/theme.ts` — Exports `Colors` (light/dark palettes) and `Fonts` (platform-specific font stacks).
- `hooks/use-color-scheme.ts` — Color scheme hook (with `.web.ts` platform variant).
- `hooks/use-theme-color.ts` — Resolves a theme color by key for the current scheme.

### Path Aliases

`@/*` maps to the project root (configured in `tsconfig.json`).

### Components

Reusable components live in `components/`. Platform-specific variants use the `.ios.tsx` suffix (e.g., `ui/icon-symbol.ios.tsx`).
