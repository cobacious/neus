# Handoff: Header & Logo Refinement

## Overview

In the previous session, we finalized and committed the static social preview asset and metadata updates (commit `599a098`). We then replaced the legacy vector SVG logo with the modern typographic wordmark (`neus`, font-weight 800, tracking `-0.04em`).

The changes to [`apps/web/src/components/Header.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/Header.tsx) and [`apps/web/src/components/Logo.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/Logo.tsx) are currently unstaged in the working copy for further refinement.

---

## User Feedback to Address Next

1. **Shorter Main Header**:
   - The new wordmark has a tighter vertical footprint than the old vector SVG.
   - The main `<header>` container currently has generous padding (`my-6 px-4 py-4 border-b border-gray-200 pb-6`).
   - Reduce the top/bottom margin and padding (e.g. `my-3 py-2 pb-3` or `my-4 py-3 pb-4`) so the header feels compact, sleek and proportioned to the new logo size.

2. **Larger Sticky Header Logo**:
   - In the sticky header variant (`showStickyHeader`), the logo was set to `text-2xl`, which appears too small in navigation context.
   - Increase the sticky header logo sizing (e.g. `text-3xl` or `text-[1.75rem]`) and align it with the drawer header so it has strong visual presence without overflowing the sticky bar height (`py-2`).

---

## Active Working Copy Files

- [`apps/web/src/components/Logo.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/Logo.tsx): Wordmark component with modern sans font stack and `-0.04em` tracking.
- [`apps/web/src/components/Header.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/Header.tsx): Sizing classes across main header, sticky header and mobile slide-over drawer.
