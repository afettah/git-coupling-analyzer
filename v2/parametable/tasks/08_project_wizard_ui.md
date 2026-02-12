# Task 08 - Project Creation Wizard UI

## Objective

Replace one-shot repo creation modal with a multi-step wizard that exposes scan intelligence, suggested presets, and direct transition to configured analysis.

## Dependencies

1. Task 01.
2. Task 03.
3. Task 07.
4. Task 10.

## Detailed Implementation

## 1) Create module `src/frontend/src/features/project-wizard/`

Files:

1. `ProjectWizard.tsx`
2. `steps/RepositoryStep.tsx`
3. `steps/ScanResultStep.tsx`
4. `steps/PresetStep.tsx`
5. `steps/ConfigureStep.tsx`
6. `steps/ReviewStep.tsx`

## 2) Wizard state machine

```ts
type WizardStep = 'repository' | 'scan' | 'preset' | 'configure' | 'review';
```

Transitions:

1. repository -> scan after create success
2. scan -> preset when scan ready
3. preset -> configure when selection made
4. configure -> review when draft valid
5. review -> run

## 3) Create + scan behavior

1. call `POST /repos`.
2. if `state=ready`, continue immediately.
3. if `state=scanning`, poll `GET /repos/{repo_id}/scan` until ready.
4. handle error state with retry actions.

## 4) Preset recommendation UX

1. show suggested preset from scan signals.
2. allow "use suggested" and "custom".
3. show included/excluded patterns preview.

## 5) Review step

Summarize:

1. commit scope
2. include/exclude counts
3. key advanced toggles
4. estimated analyzed file count

## Verification Matrix

1. happy path completes end-to-end.
2. invalid path and non-git errors handled.
3. scanning state transitions correctly.
4. selected preset affects configurator defaults.

## Definition of Done

1. Wizard replaces modal as canonical create flow.
2. It reliably hands off to configurator/run flow.

## Files To Touch

1. `src/frontend/src/features/project-wizard/ProjectWizard.tsx`
2. `src/frontend/src/features/project-wizard/steps/*.tsx`
3. `src/frontend/src/App.tsx`
4. `src/frontend/src/api/repos.ts`
5. `src/frontend/src/features/repos/CreateRepoModal.tsx`

