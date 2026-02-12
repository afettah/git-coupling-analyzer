import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { AnalysisConfigurator as GitAnalysisConfigurator } from '../../analysis-configurator';
import type { ConfigValidationResult, GitAnalysisConfig } from '../../settings/gitAnalysisConfig';
import { FileTree, type FileTreeNode } from '../../../shared/FileTree';

interface ConfigureStepProps {
  config: GitAnalysisConfig;
  validation: ConfigValidationResult;
  includePatternText: string;
  excludePatternText: string;
  treeNodes: FileTreeNode[];
  treeLoading: boolean;
  selectedPaths: Set<string>;
  dimmedPaths: Set<string>;
  repoId?: string | null;
  lastCommitDate?: string | null;
  firstCommitDate?: string | null;
  onConfigChange: (next: GitAnalysisConfig) => void;
  onValidationChange: (result: ConfigValidationResult) => void;
  onIncludePatternTextChange: (value: string) => void;
  onExcludePatternTextChange: (value: string) => void;
  onSelectionChange: (paths: Set<string>) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function ConfigureStep({
  config,
  validation,
  includePatternText,
  excludePatternText,
  treeNodes,
  treeLoading,
  selectedPaths,
  dimmedPaths,
  repoId,
  lastCommitDate,
  firstCommitDate,
  onConfigChange,
  onValidationChange,
  onIncludePatternTextChange,
  onExcludePatternTextChange,
  onSelectionChange,
  onBack,
  onNext,
}: ConfigureStepProps) {
  const hasErrors = validation.errors.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Configure Analysis</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tune analysis parameters and verify live scope preview.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <GitAnalysisConfigurator
            value={config}
            onChange={onConfigChange}
            onValidationChange={onValidationChange}
            repoId={repoId}
            lastCommitDate={lastCommitDate}
            firstCommitDate={firstCommitDate}
          />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">Scope Filters</h3>
            <p className="text-xs text-slate-500">
              Wildcards supported. Example: <code>src/*</code> or <code>**/*.test.ts</code>
            </p>
          </div>

          <label className="space-y-1 text-xs text-slate-400">
            <span>Include Patterns (one per line)</span>
            <textarea
              value={includePatternText}
              onChange={(event) => onIncludePatternTextChange(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-400">
            <span>Exclude Patterns (one per line)</span>
            <textarea
              value={excludePatternText}
              onChange={(event) => onExcludePatternTextChange(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
            />
          </label>

          {treeLoading && (
            <div className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              Updating preview...
            </div>
          )}

          <FileTree
            nodes={treeNodes}
            selectable
            selectedPaths={selectedPaths}
            onSelectionChange={onSelectionChange}
            dimmedPaths={dimmedPaths}
            virtualized
            height={380}
          />
        </div>
      </div>

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
          disabled={hasErrors}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Review
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
