export type MockProgressStage =
  | 'queued'
  | 'extracting'
  | 'building_edges'
  | 'computing_metrics'
  | 'completed';

export interface MockProgressEvent {
  state: 'queued' | 'running' | 'completed' | 'failed';
  stage: MockProgressStage;
  progress: number;
  processed_commits: number;
  total_commits: number;
  entity_count: number;
  relationship_count: number;
  elapsed_seconds: number;
  error: string | null;
}

interface StagePlan {
  stage: MockProgressStage;
  state: MockProgressEvent['state'];
  ticks: number;
  start: number;
  end: number;
}

const STAGE_PLAN: StagePlan[] = [
  { stage: 'queued', state: 'queued', ticks: 2, start: 0, end: 0.05 },
  { stage: 'extracting', state: 'running', ticks: 6, start: 0.05, end: 0.45 },
  { stage: 'building_edges', state: 'running', ticks: 6, start: 0.45, end: 0.8 },
  { stage: 'computing_metrics', state: 'running', ticks: 5, start: 0.8, end: 0.98 },
  { stage: 'completed', state: 'completed', ticks: 1, start: 1, end: 1 },
];

function buildTimeline(totalCommits: number): MockProgressEvent[] {
  const events: MockProgressEvent[] = [];
  let elapsed = 0;

  for (const stage of STAGE_PLAN) {
    for (let tick = 0; tick < stage.ticks; tick += 1) {
      const ratio = stage.ticks === 1 ? 1 : tick / (stage.ticks - 1);
      const progress = stage.start + (stage.end - stage.start) * ratio;
      elapsed += stage.stage === 'queued' ? 1 : 2;
      const processed = Math.floor(totalCommits * Math.min(progress, 1));
      const entities = Math.floor(processed * 2.1);
      const relationships = Math.floor(processed * 5.4);

      events.push({
        state: stage.state,
        stage: stage.stage,
        progress: Number(progress.toFixed(3)),
        processed_commits: processed,
        total_commits: totalCommits,
        entity_count: entities,
        relationship_count: relationships,
        elapsed_seconds: elapsed,
        error: null,
      });
    }
  }

  return events;
}

export function startMockProgressStream(
  runId: string,
  onData: (event: MockProgressEvent) => void,
): () => void {
  const totalCommits = 4500 + (runId.length % 2000);
  const timeline = buildTimeline(totalCommits);
  let cursor = 0;

  const interval = window.setInterval(() => {
    onData(timeline[cursor]);
    cursor += 1;

    if (cursor >= timeline.length) {
      window.clearInterval(interval);
    }
  }, 700);

  return () => {
    window.clearInterval(interval);
  };
}
