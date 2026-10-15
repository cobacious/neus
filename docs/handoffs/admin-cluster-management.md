# Proposal & Spec: Admin Cluster & Story Management

## Overview & Motivation

Neus is an automated news aggregation and neutral synthesis platform. However, real-world edge cases periodically occur:
- Developing news stories split across days (e.g. the Yorkshire Wildlife Park tiger incident, where the initial attack and subsequent fatal investigation formed two separate clusters).
- Tangential articles grouped into the wrong angle.
- Related angles that the LLM failed to group under the same umbrella.

Currently, [`apps/admin`](file:///Users/jwalton/Code/cobacious/neus/apps/admin) only provides feed and source management ([`SourcesPage.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/admin/src/SourcesPage.tsx)). Adding a **Cluster & Story Management** tab to the admin tool will give editors the ability to search, inspect, merge, reassign and prune clusters directly against Local, Staging or Production databases.

---

## Key Features

### 1. Cluster Search & Feed
- **Filter**: Active vs Archived, Solitary Clusters vs Multi-Angle Stories.
- **Search**: Real-time search across cluster headlines, summaries, and constituent article titles.
- **Story Context**: Clear badges showing whether a cluster belongs to an overarching story and what angle it represents.

### 2. Cluster Inspection Modal / Drawer
- View full headline, generated summary, and story angle.
- List all attached articles with source badges, publication timestamps, and external URLs.
- Show embedding similarity breakdown for attached articles.

### 3. Editorial Operations

#### A. Merge Clusters into One
- Combine two duplicate clusters covering the exact same event.
- Re-points all `ArticleCluster` rows to the primary cluster.
- Existing helper in `@neus/db`: [`mergeClusters(targetClusterId, sourceClusterIds)`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/clusters/mergeClusters.ts).

#### B. Group Clusters under a Shared Story Umbrella
- Select two or more clusters (e.g. *Initial Attack* + *Safety Investigation*).
- Assign them to a single `Story` umbrella with distinct `storyAngle` titles.
- Existing helper in `@neus/db`: [`syncStoryWithAngles(storyInput)`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/stories/syncStoryWithAngles.ts).

#### C. Detach / Disband
- Remove an erroneously clustered article back to unclustered pool.
- Disband a cluster or detach a cluster from a multi-angle story.

---

## Required Architecture & API Additions

### 1. GraphQL API (`apps/api`)
Add mutations to `apps/api/src/schema/resolvers/ClusterResolver.ts`:
- `mergeClusters(targetId: ID!, sourceIds: [ID!]!): Cluster`
- `groupClustersIntoStory(storyTitle: String!, clusterAnglePairs: [ClusterAngleInput!]!): Story`
- `removeArticleFromCluster(articleId: ID!, clusterId: ID!): Boolean`

### 2. Admin Frontend (`apps/admin`)
- Navigation tab switcher in [`App.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/admin/src/App.tsx): **Sources** | **Clusters & Stories**.
- New page component: `apps/admin/src/ClustersPage.tsx`.
- Connects through the existing environment switcher (Local, Staging and Production).
