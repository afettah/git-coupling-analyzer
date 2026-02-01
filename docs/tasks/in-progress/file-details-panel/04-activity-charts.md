# Subtask: Activity Charts

**Status:** ✅ Complete (with data limitations)  
**Effort:** 3 days

---

## Goal

Add interactive charts for file activity visualization in the Activity tab.

---

## Tasks

### Timeline View (Default)
- [x] Area chart showing commits over time (basic bar chart implemented)
- [x] Granularity toggle: Daily / Weekly / Monthly / Quarterly
- [x] Metric selector: Commits / Lines Changed / Authors Active

### Heatmap Calendar
- [x] GitHub-style contribution heatmap (basic implementation)
- [x] Color intensity = commit count
- [x] Year selector

### Day/Hour Activity Matrix
- [x] 7×24 grid showing activity patterns
- [x] Identify when file is typically modified

### Lines Changed Chart
- [x] Stacked area for additions/deletions
- [x] Color: green for additions, red for deletions
- **Note:** Requires `lines_added`/`lines_deleted` data in parquet (see global-issues.md)

### Velocity Chart
- [x] Changes per time unit
- [x] Trend line (moving average)
- [x] Peak indicators (>1.5x average)

---

## Implementation Notes

**Fixed (Jan 31, 2026):**
- Timestamp parsing now correctly converts Unix integers to datetime objects
- Charts render data correctly when available

**Data Limitation:**
- `lines_added`/`lines_deleted` are not captured during extraction (requires `--numstat`)
- These charts will show 0s until extraction is enhanced
- More polished visualizations (currently using basic CSS charts)

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
