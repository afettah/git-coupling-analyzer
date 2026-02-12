import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useSSE } from '../../hooks/useSSE';
import { createRepo, getRepoScan, type RepoInfo, type ScanSummary } from '../../api/repos';
import {
  createAnalysisConfig,
  getAnalysisRunStreamUrl,
  listAnalysisConfigs,
  getPresets,
  runAnalysis,
} from '../../api/analysis';
import { previewTree } from '../../api/tree';
import {
  applyBehaviorPreset,
  buildGitAnalyzerRunConfig,
  computeSmartDefaultsFromScan,
  DEFAULT_GIT_ANALYSIS_CONFIG,
  normalizeGitAnalysisConfig,
  validateGitAnalysisConfig,
  type ConfigValidationResult,
  type GitAnalysisConfig,
} from '../settings/gitAnalysisConfig';
import { collectLeafPathsByStatus, collectPathsByStatus } from '../../mocks/treeMock';
import type { FileTreeNode } from '../../shared/FileTree';
import ConfigureStep from './steps/ConfigureStep';
import PresetStep from './steps/PresetStep';
import RepositoryStep from './steps/RepositoryStep';
import ReviewStep from './steps/ReviewStep';
import ScanResultStep from './steps/ScanResultStep';
import type {
  PresetOption,
  PresetRecommendation,
  RepositoryDraft,
  RunProgressEvent,
  WizardStep,
} from './types';

const STEP_ORDER: WizardStep[] = ['repository', 'scan', 'preset', 'configure', 'review'];

const STEP_LABELS: Record<WizardStep, string> = {
  repository: 'Repository',
  scan: 'Scan',
  preset: 'Preset',
  configure: 'Configure',
  review: 'Review',
};

interface ProjectWizardProps {
  initialRepo?: RepoInfo | null;
  onCancel: () => void;
  onComplete: (repo: RepoInfo) => void;
}

function splitPatterns(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function convertTreeNodes(nodes: any[]): FileTreeNode[] {
  return nodes.map((node) => ({
    path: node.path,
    name: node.name,
    kind: node.kind,
    status: node.status,
    extension: node.extension ? String(node.extension).replace(/^\./, '') : undefined,
    language: node.language ?? undefined,
    children: node.children ? convertTreeNodes(node.children) : undefined,
  }));
}

async function waitForScanReady(repoId: string): Promise<ScanSummary> {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await getRepoScan(repoId);
    if (status.state === 'ready' && status.scan) {
      return status.scan;
    }
    if (status.state === 'error') {
      throw new Error(status.error || 'Repository scan failed.');
    }
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  throw new Error('Timed out while waiting for repository scan.');
}

function toPresetOptions(raw: Array<{
  id: string;
  label: string;
  description: string;
  impact: string;
  config: Record<string, unknown>;
  recommendation_reason?: string | null;
}>): { options: PresetOption[]; recommendation: PresetRecommendation | null } {
  const options: PresetOption[] = raw.map((preset) => ({
    id: preset.id,
    label: preset.label,
    description: preset.description,
    impact: preset.impact,
    changed_fields: Object.keys(preset.config ?? {}),
    recommendation_reason: preset.recommendation_reason,
  }));

  const recommended = options.find((option) => option.recommendation_reason);
  return {
    options,
    recommendation: recommended
      ? {
          preset_id: recommended.id,
          reasons: [recommended.recommendation_reason ?? 'Recommended by scan profile.'],
        }
      : null,
  };
}

export default function ProjectWizard({ initialRepo = null, onCancel, onComplete }: ProjectWizardProps) {
  const initialStep: WizardStep = initialRepo ? 'scan' : 'repository';

  const [step, setStep] = useState<WizardStep>(initialStep);
  const [repoDraft, setRepoDraft] = useState<RepositoryDraft>({ path: initialRepo?.path ?? '', name: initialRepo?.name ?? '' });
  const [repo, setRepo] = useState<RepoInfo | null>(initialRepo);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [scan, setScan] = useState<ScanSummary | null>(initialRepo?.scan ?? null);
  const [scanLoading, setScanLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);
  const [recommendation, setRecommendation] = useState<PresetRecommendation | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_GIT_ANALYSIS_CONFIG.preset_id);

  const [config, setConfig] = useState<GitAnalysisConfig>(DEFAULT_GIT_ANALYSIS_CONFIG);
  const [smartDefaults, setSmartDefaults] = useState<GitAnalysisConfig>(DEFAULT_GIT_ANALYSIS_CONFIG);
  const [prefilledFromExistingConfig, setPrefilledFromExistingConfig] = useState<boolean | null>(null);
  const [validation, setValidation] = useState<ConfigValidationResult>(validateGitAnalysisConfig(DEFAULT_GIT_ANALYSIS_CONFIG));

  const [includePatternText, setIncludePatternText] = useState<string>('src/*\ntests/*');
  const [excludePatternText, setExcludePatternText] = useState<string>('node_modules/*\ndist/*\ncoverage/*');
  const [treeNodes, setTreeNodes] = useState<FileTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const [runId, setRunId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgressEvent | null>(null);

  const completionHandled = useRef(false);

  const includePatterns = useMemo(() => splitPatterns(includePatternText), [includePatternText]);
  const excludePatterns = useMemo(() => splitPatterns(excludePatternText), [excludePatternText]);
  const debouncedIncludePatternText = useDebounce(includePatternText, 300);
  const debouncedExcludePatternText = useDebounce(excludePatternText, 300);

  const dimmedPaths = useMemo(() => collectPathsByStatus(treeNodes, 'excluded'), [treeNodes]);

  const streamUrl = useMemo(() => {
    if (!repo?.id || !runId) return null;
    return getAnalysisRunStreamUrl(repo.id, runId);
  }, [repo?.id, runId]);

  useSSE<RunProgressEvent>(streamUrl, {
    enabled: running,
    eventName: 'progress',
    onData: (payload) => {
      setProgress(payload);
      if (payload.state === 'completed' || payload.state === 'failed') {
        setRunning(false);
      }
    },
    isTerminal: (payload) => payload.state === 'completed' || payload.state === 'failed' || payload.state === 'not_found',
    maxReconnectAttempts: 8,
  });

  useEffect(() => {
    if (step !== 'scan' || !repo || scanLoading || scan) {
      return;
    }

    setStepError(null);
    setScanLoading(true);

    waitForScanReady(repo.id)
      .then((result) => {
        setScan(result);
      })
      .catch((error) => {
        setStepError(error instanceof Error ? error.message : 'Failed to load scan results.');
      })
      .finally(() => {
        setScanLoading(false);
      });
  }, [repo, scan, scanLoading, step]);

  useEffect(() => {
    if (!scan || prefilledFromExistingConfig === null) {
      return;
    }
    if (prefilledFromExistingConfig) {
      return;
    }

    const smartDefaultsResult = computeSmartDefaultsFromScan({
      commit_count: scan.commit_count,
      total_files: scan.total_files,
      total_dirs: scan.total_dirs,
      languages: scan.languages,
      frameworks: scan.frameworks,
    });
    const smart = normalizeGitAnalysisConfig({
      ...DEFAULT_GIT_ANALYSIS_CONFIG,
      ...smartDefaultsResult.config,
    });

    setSmartDefaults(smart);
    setConfig(smart);
    setSelectedPresetId(smartDefaultsResult.suggested_preset_id);
    setValidation(validateGitAnalysisConfig(smart));
  }, [scan, prefilledFromExistingConfig]);

  useEffect(() => {
    if (!repo?.id) {
      return;
    }

    let cancelled = false;
    setPrefilledFromExistingConfig(null);

    listAnalysisConfigs(repo.id)
      .then((configs) => {
        if (cancelled) return;
        const active = configs.find((configRecord) => configRecord.is_active) ?? configs[0] ?? null;
        if (!active) {
          setPrefilledFromExistingConfig(false);
          return;
        }

        const normalized = normalizeGitAnalysisConfig({
          ...DEFAULT_GIT_ANALYSIS_CONFIG,
          ...(active.config as Partial<GitAnalysisConfig>),
          preset_id: active.preset_id ?? 'custom',
        });
        setConfig(normalized);
        setValidation(validateGitAnalysisConfig(normalized));
        setSelectedPresetId(active.preset_id ?? 'custom');
        setIncludePatternText((active.include_patterns ?? []).join('\n'));
        setExcludePatternText((active.exclude_patterns ?? []).join('\n'));
        setPrefilledFromExistingConfig(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPrefilledFromExistingConfig(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repo?.id]);

  useEffect(() => {
    if (!repo || !scan) {
      return;
    }

    getPresets(repo.id)
      .then((raw) => {
        const converted = toPresetOptions(raw);
        setPresetOptions(converted.options);
        setRecommendation(converted.recommendation);
        if (converted.recommendation?.preset_id) {
          setSelectedPresetId(converted.recommendation.preset_id);
        }
      })
      .catch(() => {
        setPresetOptions([]);
        setRecommendation(null);
      });
  }, [repo, scan]);

  useEffect(() => {
    if (step !== 'configure' || !repo?.id) {
      return;
    }

    const include = splitPatterns(debouncedIncludePatternText);
    const exclude = splitPatterns(debouncedExcludePatternText);

    setTreeLoading(true);
    previewTree(repo.id, {
      include_patterns: include,
      exclude_patterns: exclude,
      max_depth: 8,
    })
      .then((nodes) => {
        const converted = convertTreeNodes(nodes);
        setTreeNodes(converted);
        setSelectedPaths(collectLeafPathsByStatus(converted, 'included'));
      })
      .catch(() => {
        setTreeNodes([]);
      })
      .finally(() => {
        setTreeLoading(false);
      });
  }, [debouncedExcludePatternText, debouncedIncludePatternText, repo?.id, step]);

  useEffect(() => {
    if (!repo || !scan || !progress || progress.state !== 'completed' || completionHandled.current) {
      return;
    }

    completionHandled.current = true;

    const updatedRepo: RepoInfo = {
      ...repo,
      state: 'completed',
      file_count: scan.total_files,
      commit_count: scan.commit_count,
      last_analyzed: new Date().toISOString(),
      scan,
    };

    window.setTimeout(() => {
      onComplete(updatedRepo);
    }, 300);
  }, [config, onComplete, progress, repo, scan]);

  const stepIndex = STEP_ORDER.indexOf(step);

  const moveToStep = (next: WizardStep) => {
    setStepError(null);
    setStep(next);
  };

  const handleCreateRepo = async () => {
    if (!repoDraft.path.trim()) {
      setStepError('Repository path is required.');
      return;
    }

    setStepError(null);
    setCreatingRepo(true);

    try {
      const created = await createRepo({ path: repoDraft.path, name: repoDraft.name || undefined });
      setRepo(created);
      if (created.scan) {
        setScan(created.scan);
      }
      moveToStep('scan');
    } catch {
      setStepError('Unable to create project from provided path.');
    } finally {
      setCreatingRepo(false);
    }
  };

  const handlePresetNext = () => {
    const base = normalizeGitAnalysisConfig(smartDefaults);
    const next = selectedPresetId === 'custom'
      ? normalizeGitAnalysisConfig({ ...base, preset_id: 'custom' })
      : applyBehaviorPreset(base, selectedPresetId);

    setConfig(next);
    setValidation(validateGitAnalysisConfig(next));
    moveToStep('configure');
  };

  const handleRun = async () => {
    if (!repo || running || validation.errors.length > 0) {
      return;
    }

    completionHandled.current = false;
    setStepError(null);

    try {
      setRunning(true);
      const runConfig = buildGitAnalyzerRunConfig(config);
      const configRecord = await createAnalysisConfig(repo.id, {
        name: `${repo.name} - ${new Date().toISOString()}`,
        description: 'Wizard generated configuration',
        preset_id: selectedPresetId === 'custom' ? null : selectedPresetId,
        config: runConfig,
        include_patterns: includePatterns,
        exclude_patterns: excludePatterns,
        is_active: true,
      });

      const run = await runAnalysis(repo.id, { config_id: configRecord.id });
      setRunId(run.run_id);
      setProgress(null);
    } catch {
      setRunning(false);
      setStepError('Unable to start analysis. Try again.');
    }
  };

  const handleQuickStart = async () => {
    if (!repoDraft.path.trim()) {
      setStepError('Repository path is required.');
      return;
    }

    setStepError(null);
    setCreatingRepo(true);

    try {
      const created = await createRepo({ path: repoDraft.path, name: repoDraft.name || undefined });
      setRepo(created);
      const scanResult = created.scan ?? await waitForScanReady(created.id);
      setScan(scanResult);

      const smartDefaultsResult = computeSmartDefaultsFromScan({
        commit_count: scanResult.commit_count,
        total_files: scanResult.total_files,
        total_dirs: scanResult.total_dirs,
        languages: scanResult.languages,
        frameworks: scanResult.frameworks,
      });

      const smartConfig = normalizeGitAnalysisConfig({
        ...DEFAULT_GIT_ANALYSIS_CONFIG,
        ...smartDefaultsResult.config,
      });

      setSmartDefaults(smartConfig);
      setConfig(smartConfig);
      setValidation(validateGitAnalysisConfig(smartConfig));
      setSelectedPresetId(smartDefaultsResult.suggested_preset_id);

      completionHandled.current = false;
      setStep('review');

      const runConfig = buildGitAnalyzerRunConfig(smartConfig);
      const configRecord = await createAnalysisConfig(created.id, {
        name: `${created.name} - quick start`,
        description: 'Quick start configuration',
        preset_id: smartDefaultsResult.suggested_preset_id,
        config: runConfig,
        include_patterns: includePatterns,
        exclude_patterns: excludePatterns,
        is_active: true,
      });

      const run = await runAnalysis(created.id, { config_id: configRecord.id });
      setRunId(run.run_id);
      setProgress(null);
      setRunning(true);
    } catch {
      setRunning(false);
      setStepError('Unable to start analysis. Try again.');
    } finally {
      setCreatingRepo(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STEP_ORDER.map((item, index) => {
          const done = index < stepIndex;
          const active = item === step;

          return (
            <div key={item} className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  active
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                    : done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 bg-slate-900 text-slate-500'
                }`}
              >
                {STEP_LABELS[item]}
              </span>
              {index < STEP_ORDER.length - 1 && <span className="text-xs text-slate-600">/</span>}
            </div>
          );
        })}
      </div>

      {stepError && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {stepError}
        </div>
      )}

      {step === 'repository' && (
        <RepositoryStep
          draft={repoDraft}
          loading={creatingRepo}
          error={stepError}
          onDraftChange={setRepoDraft}
          onNext={handleCreateRepo}
          onQuickStart={handleQuickStart}
          onCancel={onCancel}
        />
      )}

      {step === 'scan' && (
        <ScanResultStep
          repoName={repo?.name ?? 'Repository'}
          scan={scan}
          recommendation={recommendation}
          loading={scanLoading}
          onBack={() => (initialRepo ? onCancel() : moveToStep('repository'))}
          onNext={() => moveToStep('preset')}
        />
      )}

      {step === 'preset' && (
        <PresetStep
          options={presetOptions}
          selectedPresetId={selectedPresetId}
          recommendedPresetId={recommendation?.preset_id ?? null}
          onSelect={setSelectedPresetId}
          onBack={() => moveToStep('scan')}
          onNext={handlePresetNext}
        />
      )}

      {step === 'configure' && (
        <ConfigureStep
          config={config}
          validation={validation}
          includePatternText={includePatternText}
          excludePatternText={excludePatternText}
          treeNodes={treeNodes}
          treeLoading={treeLoading}
          selectedPaths={selectedPaths}
          dimmedPaths={dimmedPaths}
          repoId={repo?.id ?? null}
          lastCommitDate={scan?.last_commit_date ?? null}
          firstCommitDate={scan?.first_commit_date ?? null}
          onConfigChange={(next) => {
            const normalized = normalizeGitAnalysisConfig(next);
            setConfig(normalized);
            setValidation(validateGitAnalysisConfig(normalized));
          }}
          onValidationChange={setValidation}
          onIncludePatternTextChange={setIncludePatternText}
          onExcludePatternTextChange={setExcludePatternText}
          onSelectionChange={setSelectedPaths}
          onBack={() => moveToStep('preset')}
          onNext={() => moveToStep('review')}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          repoName={repo?.name ?? 'Repository'}
          selectedPresetId={selectedPresetId}
          config={config}
          baseline={DEFAULT_GIT_ANALYSIS_CONFIG}
          validation={validation}
          includePatterns={includePatterns}
          excludePatterns={excludePatterns}
          selectedFileCount={selectedPaths.size}
          progress={progress}
          running={running}
          onBack={() => moveToStep('configure')}
          onRun={handleRun}
        />
      )}
    </div>
  );
}
