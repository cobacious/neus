# Investigation: Yorkshire Tiger Enclosure Incident Story Duplication

## Overview

Two separate clusters exist on production for the exact same event (a fatal incident on 10 October where a man climbed into a tiger enclosure at Yorkshire Wildlife Park). Each was organized into its own solitary story umbrella instead of being grouped together as angles of the same story.

---

## The Production Data

### Cluster 1 (Initial Attack)
- **Cluster ID**: `cmv2lv1ma005h4c3z6904eid6`
- **Slug**: `serious-incident-at-yorkshire-wildlife-park-involves-tiger-attack`
- **Headline**: *Serious Incident at Yorkshire Wildlife Park Involves Tiger Attack*
- **Angle**: `Initial Attack and Response`
- **Assigned Story ID**: `cmv52k9a8008r4c3cgvpy19by`
- **Story Title**: *Tiger Attack at Yorkshire Wildlife Park: Incident and Aftermath*
- **Summary**: Man sustained serious injuries after entering tiger enclosure; emergency response procedures activated and staff shot tiger.

### Cluster 2 (Investigation & Fatality Confirmation)
- **Cluster ID**: `cmv5jwpri009e4c43ngbvsy4v`
- **Slug**: `investigation-launched-after-man-killed-by-tiger-at-yorkshire-wildlife-park`
- **Headline**: *Investigation Launched After Man Killed by Tiger at Yorkshire Wildlife Park*
- **Angle**: `Official Safety Investigation`
- **Assigned Story ID**: `cmv5k3brb00ah4c434wevi0q4`
- **Story Title**: *Fatal Tiger Enclosure Incident at Yorkshire Wildlife Park*
- **Summary**: Man died following attack inside tiger enclosure; health and safety officials opened an investigation.

---

## Why They Split

1. **Temporal Delay**:
   - Cluster 1 was formed during initial breaking reports over the weekend (injury reported).
   - Cluster 2 was formed later when death was confirmed and the safety investigation opened.
2. **`organizeStoryAngles.ts` Lookback & Prompting**:
   - In [`apps/engine/core/pipeline/organizeStoryAngles.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/organizeStoryAngles.ts), stories with fewer than 2 angles are supposed to be disbanded into standalone clusters, or existing stories should have new angles merged in.
   - If Cluster 1 was created earlier, was it still in the active candidate pool when Cluster 2 was organized, or did the LLM treat "attack" and "investigation" as separate stories rather than angles of one story?

---

## Action Items for Tomorrow

1. **Merge / Consolidate into One Story**:
   - Associate both clusters under a single story umbrella: *Fatal Tiger Enclosure Incident at Yorkshire Wildlife Park*.
   - Angle 1: `Initial Attack and Response` ([`cmv2lv1ma005h4c3z6904eid6`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/ClusterDetailPage.tsx))
   - Angle 2: `Official Safety Investigation` ([`cmv5jwpri009e4c43ngbvsy4v`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/ClusterDetailPage.tsx))
   - Disband or delete the duplicate empty story `cmv52k9a8008r4c3cgvpy19by`.
2. **Review `organizeStoryAngles.ts` Merge Rules**:
   - Ensure the story organization prompt specifically matches developing angles to existing stories even when days apart.
