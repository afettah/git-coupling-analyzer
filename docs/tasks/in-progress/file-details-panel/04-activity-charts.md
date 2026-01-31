# Subtask: Activity Charts

**Status:** Not Started  
**Effort:** 3 days

---

## Goal

Add interactive charts for file activity visualization in the Activity tab.

---

## Tasks

### Timeline View (Default)
- [ ] Area chart showing commits over time
- [ ] Granularity toggle: Daily / Weekly / Monthly / Quarterly
- [ ] Metric selector: Commits / Lines Changed / Authors Active

### Heatmap Calendar
- [ ] GitHub-style contribution heatmap
- [ ] Color intensity = commit count
- [ ] Year selector

### Day/Hour Activity Matrix
- [ ] 7×24 grid showing activity patterns
- [ ] Identify when file is typically modified

### Lines Changed Chart
- [ ] Stacked area for additions/deletions
- [ ] Color: green for additions, red for deletions

### Velocity Chart
- [ ] Changes per time unit
- [ ] Trend line
- [ ] Peak indicators

---

## Design: Timeline View

```
Commits │
   20   │                    ████
   15   │              ████  ████  ████
   10   │        ████  ████  ████  ████  ████
    5   │  ████  ████  ████  ████  ████  ████  ████
    0   └──────────────────────────────────────────────
          Jan   Feb   Mar   Apr   May   Jun   Jul
          2025
        
        [Daily] [Weekly] [Monthly] [Quarterly]
        
        Metric: [● Commits  ○ Lines Changed  ○ Authors Active]
```

## Design: Heatmap Calendar

```
     Jan        Feb        Mar        Apr        May
Mon  ░░▓▓░░░   ░░░▓░░░   ▓▓▓░░░░   ░░░░░░░   ░▓▓░░░░
Wed  ░▓▓▓░░░   ░░▓▓░░░   ▓▓▓▓░░░   ░░░░▓░░   ▓▓▓░░░░
Fri  ░░▓░░░░   ░▓▓▓░░░   ░▓▓░░░░   ░░▓▓▓░░   ░▓░░░░░

     ░ 0  ▒ 1-2  ▓ 3-5  █ 6+  commits

     [📅 2024] [📅 2025] [📅 All Time]
```

---

## Relevant Files

- `frontend/src/components/FileDetailsPanel.tsx`
- `frontend/src/components/charts/ActivityTimeline.tsx` (new)
- `frontend/src/components/charts/HeatmapCalendar.tsx` (new)
