import { ArrowLeft, CheckCircle2, Loader2, Play } from 'lucide-react';
import type { ConfigValidationResult, GitAnalysisConfig } from '../../settings/gitAnalysisConfig';
import type { RunProgressEvent } from '../types';

interface ReviewStepProps {
  repoName: string;
  selectedPresetId: string;
  config: GitAnalysisConfig;
  baseline: GitAnalysisConfig;
  validation: ConfigValidationResult;
  includePatterns: string[];
  excludePatterns: string[];
  selectedFileCount: number;
  progress: RunProgressEvent | null;
  running: boolean;
  onBack: () => void;
  onRun: () => void;
}

function formatStageLabel(stage: string | undefined): string {
  if (!stage) {
    return 'pending';
  }
  return stage.replace(/_/g, ' ');
}

export default function ReviewStep({
  repoName,
  selectedPresetId,
  config,
  baseline,
  validation,
  includePatterns,
  excludePatterns,
  selectedFileCount,
  progress,
  running,
  onBack,
  onRun,
}: ReviewStepProps) {
  const hasErrors = validation.errors.length > 0;

  const changedFields = Object.keys(config).filter((key) => {
    const typedKey = key as keyof GitAnalysisConfig;
    return JSON.stringify(config[typedKey]) !== JSON.stringify(baseline[typedKey]);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Review & Run</h2>
        <p className="mt-1 text-sm text-slate-400">
          Confirm configuration for <span className="text-slate-200">{repoName}</span>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Summary</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Preset</dt>
              <dd className="text-slate-200">{selectedPresetId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Changed params</dt>
              <dd className="text-slate-200">{changedFields.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Estimated included files</dt>
              <dd className="text-emerald-300">{selectedFileCount.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Include patterns</dt>
              <dd className="text-slate-200">{includePatterns.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Exclude patterns</dt>
              <dd className="text-slate-200">{excludePatterns.length}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Diff From Defaults</h3>
          <div className="mt-3 max-h-40 overflow-auto space-y-1 text-xs">
            {changedFields.map((field) => {
              const key = field as keyof GitAnalysisConfig;
              return (
                <div key={field} className="rounded border border-slate-700 bg-slate-950/60 px-2 py-1">
                  <span className="text-slate-500">{field}</span>{' '}
                  <span className="text-slate-300">{JSON.stringify(baseline[key])}</span>{' '}
                  <span className="text-sky-300">-&gt; {JSON.stringify(config[key])}</span>
                </div>
              );
            })}
            {changedFields.length === 0 && <p className="text-slate-500">No changes from defaults.</p>}
          </div>
        </div>
      </div>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <h3 className="mb-2 font-semibold text-amber-200">Validation</h3>
          {validation.errors.map((message) => (
            <p key={message} className="text-xs text-red-300">Error: {message}</p>
          ))}
          {validation.warnings.map((message) => (
            <p key={message} className="text-xs text-amber-100">Warning: {message}</p>
          ))}
        </div>
      )}

      {progress && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-300">Stage: {formatStageLabel(progress.stage)}</span>
            <span className="text-slate-400">{Math.round(progress.progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500"
              style={{ width: `${Math.max(2, Math.round(progress.progress * 100))}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Commits: {progress.processed_commits}/{progress.total_commits}</span>
            <span>Entities: {progress.entity_count}</span>
            <span>Edges: {progress.relationship_count}</span>
            <span>Elapsed: {progress.elapsed_seconds}s</span>
          </div>
          {progress.state === 'completed' && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
              <CheckCircle2 size={13} />
              Analysis complete
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-60"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <button
          type="button"
          onClick={onRun}
          disabled={hasErrors || running || progress?.state === 'completed'}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {progress?.state === 'completed' ? 'Completed' : 'Run Analysis'}
        </button>
      </div>
    </div>
  );
}
