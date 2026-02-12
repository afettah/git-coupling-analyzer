import { ArrowLeft, ArrowRight, Cpu, Files, GitCommit, Languages } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PresetRecommendation } from '../types';
import type { ScanSummary } from '../../../api/repos';

interface ScanResultStepProps {
  repoName: string;
  scan: ScanSummary | null;
  recommendation: PresetRecommendation | null;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

export default function ScanResultStep({
  repoName,
  scan,
  recommendation,
  loading,
  onBack,
  onNext,
}: ScanResultStepProps) {
  const languageEntries = Object.entries(scan?.languages ?? {}).sort((left, right) => right[1] - left[1]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Scan Summary</h2>
        <p className="mt-1 text-sm text-slate-400">
          Repository intelligence for <span className="text-slate-200">{repoName}</span>.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg bg-slate-800/60" />
          <div className="h-24 animate-pulse rounded-lg bg-slate-800/50" />
          <div className="h-24 animate-pulse rounded-lg bg-slate-800/40" />
        </div>
      ) : scan ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard label="Files" value={scan.total_files.toLocaleString()} icon={<Files size={14} />} />
            <MetricCard label="Directories" value={scan.total_dirs.toLocaleString()} icon={<Cpu size={14} />} />
            <MetricCard label="Commits" value={scan.commit_count.toLocaleString()} icon={<GitCommit size={14} />} />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Detected Languages</h3>
              {recommendation && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                  Suggested preset: {recommendation.preset_id}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {languageEntries.map(([language, count]) => (
                <span
                  key={language}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-300"
                >
                  <Languages size={12} />
                  {language}
                  <strong className="text-slate-100">{count}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Detected Frameworks</h3>
            <div className="flex flex-wrap gap-2">
              {scan.frameworks.map((framework) => (
                <span key={framework} className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
                  {framework}
                </span>
              ))}
            </div>
            {recommendation && (
              <p className="mt-3 text-xs text-slate-400">{recommendation.reasons.join(' ')}</p>
            )}
          </div>
        </>
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={loading || !scan}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Continue
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
