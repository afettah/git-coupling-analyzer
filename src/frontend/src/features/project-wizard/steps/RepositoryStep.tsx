import { Loader2, Play, X } from 'lucide-react';
import type { RepositoryDraft } from '../types';

interface RepositoryStepProps {
  draft: RepositoryDraft;
  loading: boolean;
  error: string | null;
  onDraftChange: (next: RepositoryDraft) => void;
  onNext: () => void;
  onQuickStart: () => void;
  onCancel: () => void;
}

export default function RepositoryStep({
  draft,
  loading,
  error,
  onDraftChange,
  onNext,
  onQuickStart,
  onCancel,
}: RepositoryStepProps) {
  const canContinue = draft.path.trim().length > 0 && !loading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Repository</h2>
        <p className="mt-1 text-sm text-slate-400">
          Start with repository path and optional project name.
        </p>
      </div>

      <div className="grid gap-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Repository Path</span>
          <input
            type="text"
            value={draft.path}
            onChange={(event) => onDraftChange({ ...draft, path: event.target.value })}
            placeholder="/home/user/workspace/project"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-slate-300">Project Name (optional)</span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            placeholder="Auto-derived when empty"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
        >
          <X size={15} />
          Cancel
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onQuickStart}
            disabled={!canContinue}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 hover:bg-emerald-500"
            title="Create project and start analysis with default settings"
          >
            {loading && <Loader2 className="animate-spin" size={14} />}
            <Play size={14} />
            Start Analysis
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!canContinue}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading && <Loader2 className="animate-spin" size={14} />}
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}
