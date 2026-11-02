# PRD-006: Editorial Dark Theme System

- **Identifier**: `PRD-006`
- **Priority**: P6 (Visual Polish & Reader Comfort)
- **Status**: Backlog / Specification Ready
- **Target Packages**: `apps/web`
- **Target Personas**: Nighttime Reader, Low-Light Mobile Consumer, OLED Device User
- **Estimated Effort**: Medium (~3 to 5 hours)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
Neus is designed for calm, thoughtful news consumption. However, the application currently operates exclusively in light mode (`bg-gray-100` background, pure white `#ffffff` cards and light borders). For readers who browse news in low-light environments (such as in bed, on evening transit or in dim workspaces), bright white displays cause eye strain and rapid battery drain on OLED mobile displays.

### 1.2 The Solution
Implement a first-class, accessible dark theme across the web application:
1. **System Preference Detection**: Automatically respect OS settings via CSS media query `(prefers-color-scheme: dark)`.
2. **Explicit User Toggle**: A 3-state toggle (System / Light / Dark) accessible in the drawer navigation and header, persisted in `localStorage`.
3. **Palette Dark Mode Tokens**: Extend the canonical 6-color editorial palette in [`apps/web/src/utils/palette.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/utils/palette.ts) with calibrated dark-mode tints, borders and text values meeting WCAG AA contrast (>= 4.5:1).
4. **Zero Flash of Unstyled Theme (FOUT)**: Inline script in `index.html` to apply the `.dark` class to `<html>` prior to React DOM mounting.

---

## 2. User Stories

1. **Automatic System Harmony**:
   * *As an* iOS or Android reader with system dark mode enabled,
   * *I want* Neus to open automatically in dark mode without manual configuration,
   * *So that* my eyes are not blinded by bright white pages at night.

2. **Manual Theme Override**:
   * *As a* reader who prefers reading news in dark mode even when my computer is in daytime mode,
   * *I want to* toggle the theme in the drawer menu,
   * *So that* my personal choice is permanently remembered across visits.

3. **High-Contrast Editorial Legibility**:
   * *As an* accessibility-conscious reader,
   * *I want* thread colors, source favicons, sparklines and histograms to remain clearly legible in dark mode,
   * *So that* narrative clarity and multi-angle visual comparisons are never degraded.

---

## 3. Technical Architecture & UI Components

### 3.1 Theme State Architecture
1. **Inline Pre-render Script in [`apps/web/index.html`](file:///Users/jwalton/Code/cobacious/neus/apps/web/index.html)**:
   Executes synchronously in `<head>` before CSS/JS render to prevent flashing white:
   ```html
   <script>
     (function() {
       try {
         const theme = localStorage.getItem('neus-theme') || 'system';
         const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
         if (isDark) document.documentElement.classList.add('dark');
       } catch (e) {}
     })();
   </script>
   ```

2. **React Theme Hook & Provider**:
   Create `apps/web/src/context/ThemeContext.tsx`:
   - State: `'system' | 'light' | 'dark'`
   - Listens to `window.matchMedia('(prefers-color-scheme: dark)')` when in `system` mode.
   - Synchronizes `<meta name="theme-color">` between `#4F6D7A` (light) and `#1F2937` (dark).

### 3.2 Palette Dark Mode Calibration (`apps/web/src/utils/palette.ts`)
Add dark variants to `BrandColorSwatch`:
```typescript
export interface BrandColorSwatch {
  id: BrandColorKey;
  name: string;
  color: string;
  // Light mode tokens
  bg: string;
  border: string;
  text: string;
  // Dark mode tokens (WCAG AA compliant against #111827 / #1F2937)
  darkBg: string;
  darkBorder: string;
  darkText: string;
}
```

Calibrated values:
* **Blue Slate (`#4F6D7A`)**:
  * Light: `bg: #EEF3F5`, `border: #4F6D7A`, `text: #223842`
  * Dark: `darkBg: rgba(79, 109, 122, 0.22)`, `darkBorder: #6B8E9E`, `darkText: #B8D0D9`
* **Burnt Peach (`#DD6E42`)**:
  * Light: `bg: #FCF1EC`, `border: #DD6E42`, `text: #4C2112`
  * Dark: `darkBg: rgba(221, 110, 66, 0.22)`, `darkBorder: #E68862`, `darkText: #F8C8B5`

### 3.3 Tailwind Semantic Component Tokens
Configure Tailwind in `tailwind.config.js`:
- `darkMode: 'class'`
- Refactor core layouts with standard dark variants:
  - Backgrounds: `bg-gray-100 dark:bg-gray-950`
  - Cards & Containers: `bg-white dark:bg-gray-900`
  - Borders: `border-gray-200 dark:border-gray-800`
  - Body Text: `text-gray-900 dark:text-gray-100`
  - Muted Text: `text-gray-500 dark:text-gray-400`
  - Sparkline Rails: `bg-gray-200 dark:bg-gray-800`

### 3.4 Theme Toggle UI (`<ThemeToggle>`)
- Positioned in the mobile hamburger drawer and desktop settings menu.
- Segmented 3-button control:
  - 🖥️ `System`
  - ☀️ `Light`
  - 🌙 `Dark`

---

## 4. Financial & Performance Budget Impact

- **Infrastructure Cost**: **$0.00**. Client-side CSS and React context.
- **Bundle Size**: Tailwind purge compiles only used `dark:` classes (~2.5 KB gzipped).
- **Runtime Performance**: Zero recalculation overhead; handled natively by the CSS cascade.

---

## 5. Acceptance Criteria

- [ ] **GIVEN** a browser with dark OS preference, **WHEN** loading Neus for the first time without prior configuration, **THEN** it renders in dark theme without white flash.
- [ ] **GIVEN** a user selects "Dark" in the drawer menu, **WHEN** restarting the browser or reloading the page, **THEN** the selection persists in `localStorage`.
- [ ] **GIVEN** dark theme is active, **WHEN** viewing timeline sparklines, histograms, thread pills and source badges, **THEN** all elements maintain accessible color contrast (> 4.5:1).
- [ ] **GIVEN** dark theme is active on mobile Safari/Chrome, **WHEN** inspecting browser chrome and notch area, **THEN** `<meta name="theme-color">` matches dark background.
- [ ] **GIVEN** `pnpm test` and `pnpm build`, **THEN** all existing tests and Vite production builds succeed.

---

## 6. Test & Verification Plan

1. **Accessibility & Contrast Verification**:
   - Run automated Axe / Lighthouse accessibility audit verifying zero color contrast regressions in dark mode.
2. **Visual Snapshot Tests**:
   - Verify cluster cards, story detail view, drawers, modals and sparklines in both light and dark modes.
3. **Cross-Browser Verification**:
   - Validate on iOS Safari, macOS Safari, Chrome and Firefox.
