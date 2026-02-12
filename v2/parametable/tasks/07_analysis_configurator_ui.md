# Task 07 - Analysis Configurator UI

## Objective

Build a full configuration UX with sectioned parameters, live tree preview, inline validation, and run orchestration.

## Dependencies

1. Task 02.
2. Task 03.
3. Task 06.

## Detailed Implementation

## 1) Create module `src/frontend/src/features/analysis-configurator/`

Core files:

1. `AnalysisConfigurator.tsx`
2. `sections/CommitRangeSection.tsx`
3. `sections/AuthorFilterSection.tsx`
4. `sections/PathFilterSection.tsx`
5. `sections/ExtensionFilterSection.tsx`
6. `sections/PresetSection.tsx`
7. `sections/ChangesetSection.tsx`
8. `sections/GitOptionsSection.tsx`
9. `sections/EdgeComputationSection.tsx`
10. `sections/TimeWeightingSection.tsx`
11. `sections/ComponentSection.tsx`
12. `sections/PerformanceSection.tsx`
13. `LivePreview/TreePreview.tsx`
14. `LivePreview/StatsPreview.tsx`
15. `LivePreview/CommitRangePreview.tsx`

## 2) State model

```ts
interface ConfiguratorState {
  draft: Partial<AnalysisConfig>;
  issues: ConfigIssue[];
  preview: TreePreviewResponse | null;
  showAdvanced: Record<string, boolean>;
  saving: boolean;
  running: boolean;
}
```

## 3) Live preview pipeline

1. map draft filters to `TreeFilterRequest`.
2. debounce 300ms.
3. call `/tree/preview`.
4. update preview pane and counters.

Debounce pseudocode:

```ts
const triggerPreview = useMemo(() => debounce(async (f: TreeFilterRequest) => {
  const r = await treeApi.preview(repoId, f);
  setPreview(r);
}, 300), [repoId]);
```

## 4) Validation UX

1. run validate-on-change or validate-on-save strategy.
2. show `error` near field and section summary.
3. warnings shown but non-blocking.
4. run button disabled on errors.

## 5) Save and run flow

1. `POST /analysis/configs` (or `PUT` existing)
2. `POST /analysis/run {config_id}`
3. navigate to progress screen

Pseudo flow:

```ts
const cfg = await analysisApi.saveConfig(repoId, draft)
const run = await analysisApi.run(repoId, { config_id: cfg.config_id })
navigate(`/repos/${repoId}/analysis/runs/${run.run_id}`)
```

## Verification Matrix

1. all sections update same draft object.
2. preview updates accurately with filter changes.
3. invalid combinations block run.
4. successful run links to progress stream.

## Definition of Done

1. Configurator is complete and production-usable.
2. It covers all parameter categories in design.

## Files To Touch

1. `src/frontend/src/features/analysis-configurator/AnalysisConfigurator.tsx`
2. `src/frontend/src/features/analysis-configurator/sections/*.tsx`
3. `src/frontend/src/features/analysis-configurator/LivePreview/*.tsx`
4. `src/frontend/src/api/analysis.ts`
5. `src/frontend/src/api/tree.ts`

