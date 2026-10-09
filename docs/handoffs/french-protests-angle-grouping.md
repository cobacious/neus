# Handoff: French Education Protests Story Angle Grouping

## Overview & Objective

This handoff document provides a granular analysis of the **French Education Protests and Police Clashes** story ([`cmuxginpk017t1o2z517dtyyv`](file:///Users/jwalton/Code/cobacious/neus/packages/db/prisma/schema.prisma)), including article assignments, taxonomy anomalies, and actionable proposals for refining Neus's angle clustering pipeline.

The goal is to ensure multi-angle stories achieve **sharp semantic division**, avoid **monolithic catch-all clusters**, and uphold **source neutrality** (preventing single-outlet editorial narratives from masquerading as distinct angles).

---

## Current Story Structure & Article Inventory

**Story Title**: *French Education Protests and Police Clashes*  
**Overview**: *Widespread protests led by high school students, teachers, and parents over deteriorating school conditions, budget cuts, and lack of resources have led to massive demonstrations across France. Tensions escalated significantly following police use of force, culminating in a severe injury to a teenage protester from a stun grenade and subsequent government suspension of the weapon amid continuing civil unrest.*  
**Total Articles**: 22 articles across 3 angles.

---

### Angle 1: Police Stun Grenade Suspension (6 articles)
- **Cluster ID**: `cmuxginpl017s1o2zjk41j71w`
- **Headline**: *France Suspends Police Stun Grenades as High School Protests Lead to Widespread Closures*
- **Summary**: *Following intense protests where a high-school student lost a hand due to a police blast grenade, French authorities have officially suspended the use of stun grenades at student demonstrations. Prime Minister Sebastien Lecornu defended police conduct while promising an investigation, as tensions remain high and schools experience widespread disruption.*

| Source | Title | Published (UTC) | Evaluation |
| :--- | :--- | :--- | :--- |
| **POLITICO** | ‘Accidents happen’: French PM defends police after stun grenade... | 2026-10-07 11:27 | ✅ Core topic |
| **The Guardian** | French police suspend use of stun grenades after high-school protester loses hand | 2026-10-07 09:09 | ✅ Core topic |
| **BBC News** | France halts use of stun grenades after boy's hand blown off in student protests | 2026-10-07 10:23 | ✅ Core topic |
| **Al Jazeera** | France halts police use of stun grenades at student protests | 2026-10-07 09:41 | ✅ Core topic |
| **The Guardian** | ‘This is state violence’: Paris students rage at politicians and heavy-handed policing | 2026-10-06 16:23 | ⚠️ Borderline (reaction to violence) |
| **The Sun** | Half of French sixth form schools close as student clashes with cops worsen... | 2026-10-06 22:38 | ❌ Miscategorized (School closure focus) |

---

### Angle 2: Nationwide Demonstrations and Clashes (13 articles)
- **Cluster ID**: `cmuxginpm017u1o2zjk58usts`
- **Headline**: *Mass Protests Over School Funding and Conditions Spark Clashes Across France*
- **Summary**: *More than 250,000 students, teachers, and parents have taken to the streets across France to demand increased funding, better resources, and improved conditions in secondary schools. The nationwide demonstrations have led to widespread school closures and confrontations with police, who deployed teargas and baton charges against demonstrators. Hundreds of injuries have been reported among students and staff amid escalating tensions and accusations of heavy-handed policing.*

| Source | Title | Published (UTC) | Evaluation / Sub-Theme |
| :--- | :--- | :--- | :--- |
| **The Guardian** | Riot police fire teargas as 250,000 take part in schools protests across France | 2026-10-06 17:39 | 🔹 Core Mobilization & Police Clashes |
| **BBC News** | Tear gas in Paris and Marseille as school protests grow across France | 2026-10-06 18:03 | 🔹 Core Mobilization & Police Clashes |
| **Al Jazeera** | ‘We’re short of resources’: France’s student protesters, in their own words | 2026-10-07 08:32 | 🔹 Student Demands & Grievances |
| **The Guardian** | French students vow to continue protests, saying ministers’ pledges not enough | 2026-10-08 15:00 | 🔹 Student Demands & Demands |
| **BBC News** | France's school protests: What lies behind the anger | 2026-10-08 03:38 | 🔸 Context & Analytical Overview |
| **Al Jazeera** | ‘This is a crisis of hope’: Echoes of 1968 as France’s students rise up | 2026-10-08 14:01 | 🔸 Historical Analysis (1968 Echoes) |
| **The Guardian** | I see what’s happening here in Paris: reasonable student demands met with awful violence | 2026-10-07 05:00 | 🔸 Opinion / Editorial Perspective |
| **Metro** | ‘Children are losing eyes and teeth in France protests – police are out of control’ | 2026-10-08 11:01 | ⚠️ Heavy-handed policing / Injury accounts |
| **Mail Online** | Student union warns France riots 'WILL intensify' if they are 'not listened to'... | 2026-10-07 01:27 | ⚠️ Strike escalation warning |
| **Mail Online** | That'll teach 'em! French school protesters are dragged away by their parents... | 2026-10-07 16:23 | ⚠️ Viral video / Tabloid reaction |
| **Mail Online** | Trump blames French student riots on 'mass migration' and says 'this isn't about schools'... | 2026-10-07 06:34 | ⚡ **International Political Reaction** |
| **Mail Online** | The Muslim far-left mayor at the forefront of France's student protests... | 2026-10-08 13:47 | ⚡ **Political Controversy (Paris Mayor)** |
| **Mail Online** | Moment French riot police violently clash with students... as Muslim far-Left mayor poses for selfies | 2026-10-09 01:49 | ⚡ **Political Controversy (Paris Mayor)** |

---

### Angle 3: Early Escalation and Violent Incidents (3 articles)
- **Cluster ID**: `cmut8mtpr00tt1o4we4651ne8`
- **Headline**: *Violent Incidents Reported Across France Amid Ongoing Protests*
- **Summary**: *Protests across France have intensified, leading to reports of severe violence including assaults on an off-duty police officer, a firefighter, and bystanders. The demonstrations have involved students and drawn participation from local officials as widespread unrest continues to affect the country.*

| Source | Title | Published (UTC) | Evaluation |
| :--- | :--- | :--- | :--- |
| **Mail Online** | Left-wing Parisian mayor joins in the riots... as firefighter is set alight and protesters threaten Elysee | 2026-10-03 18:19 | ⚠️ 100% Mail Online; Early isolated violence |
| **Mail Online** | Rioter blasts woman in the face with a flamethrower and off-duty cop is kicked unconscious... | 2026-10-02 18:05 | ⚠️ 100% Mail Online; Early isolated violence |
| **Mail Online** | Boy, 15, arrested for burning woman's face with makeshift flame-thrower... | 2026-10-03 22:30 | ⚠️ 100% Mail Online; Follow-up to flamethrower |

---

## Key Diagnostic Findings & Anomalies

1. **Monolithic Catch-All Angle (Angle 2)**:
   - Containing 13 out of 22 articles (59%), Angle 2 functions as a general repository rather than a sharp editorial angle.
   - Distinct narratives (Trump's immigration rhetoric, political attacks on the Parisian mayor, in-depth 1968 historical retrospectives, and frontline street clashes) are all lumped together.

2. **Single-Source Angle Anomaly (Angle 3)**:
   - Angle 3 is **100% sourced from Mail Online** across all 3 articles.
   - Neus is committed to neutrality and multi-perspective coverage. Having an angle whose sole voice is a right-wing tabloid focusing on sensational violence (flamethrowers, firefighters set on fire) skews the neutrality balance if presented as a general story facet.
   - Furthermore, these articles were published on Oct 2–3, days before the high-school student union mobilization on Oct 6–8.

3. **Semantic Leakage on the "Paris Mayor" Topic**:
   - The Parisian mayor narrative is split across **both Angle 2 and Angle 3**:
     - Angle 3 (Oct 3): *"Left-wing Parisian mayor joins in the riots..."*
     - Angle 2 (Oct 8): *"The Muslim far-left mayor at the forefront of France's student protests..."*
     - Angle 2 (Oct 9): *"Moment French riot police clash... as Muslim far-Left mayor poses for selfies"*
   - This proves the angle boundaries between Angle 2 and Angle 3 are leaking.

---

## Proposed Angle Realignment Plan

### Recommended 3-Angle Structure:

```
Story: French Education Protests and Political Fallout
├── Angle A: Police Stun Grenade Ban & Use-of-Force Backlash (~6 articles)
│   └── Focus: Student injury (lost hand), PM defense, weapon ban, police violence debate.
│       [BBC, Guardian, Al Jazeera, Politico]
│
├── Angle B: Nationwide Student Walkouts & Education Funding Demands (~11 articles)
│   └── Focus: 250,000 marchers, school blockades, tear gas, union ultimatums, conditions in schools.
│       [Guardian, BBC, Al Jazeera, Metro, Mail Online]
│
└── Angle C: Political Polarization & Culture War Commentary (~5 articles)
    └── Focus: Trump Truth Social intervention, controversy surrounding the Parisian mayor, political blame game.
        [Mail Online (3-4 articles), Guardian opinion, Al Jazeera reflection]
```

### Why this is better:
1. **Dissolves the single-source Angle 3**: The early Oct 2–3 mayor/violence articles merge logically with the later Oct 8–9 mayor and Trump articles under *Political Polarization & Culture War Commentary*.
2. **Breaks down the 13-article monster angle**: Disentangles political culture-war talking points from the actual street protests and teacher/student demands.
3. **Preserves Angle 1's tight focus**: The stun grenade suspension remains a concrete, high-impact policy angle supported by multiple respected sources.

---

## How to Test & Apply the Realignment

### 1. Database Inspection Script
Inspect the story and member clusters directly:
```bash
pnpm --filter @neus/db exec tsx -e "
import { prisma } from './src/client';
async function run() {
  const c = await prisma.cluster.findMany({
    where: { storyId: 'cmuxginpk017t1o2z517dtyyv' },
    select: { id: true, storyAngle: true, headline: true, _count: { select: { articleAssignments: true } } }
  });
  console.log(c);
}
run();"
```

### 2. Trigger Engine Realignment
In [`apps/engine/core/pipeline/organizeStoryAngles.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/organizeStoryAngles.ts), inspect `realignStoryArticles`:
- It prompts the LLM with all articles across the story and existing angles to determine optimal reassignment.
- You can invoke the realignment function on this story in an isolated runner or adjust the cluster prompt in `organizeStoryAngles.ts` to encourage splitting when an angle exceeds 8 articles.
