export type ChangesetMode = 'by_commit' | 'by_author_time' | 'by_ticket_id';
export type ValidationMode = 'strict' | 'soft' | 'permissive';

export interface GitAnalysisConfig {
  preset_id: string;
  since: string | null;
  until: string | null;
  window_days: number | null;
  ref: string;
  all_refs: boolean;
  skip_merge_commits: boolean;
  first_parent_only: boolean;
  find_renames_threshold: number;
  max_changeset_size: number | null;
  max_logical_changeset_size: number | null;
  min_revisions: number;
  min_cooccurrence: number;
  changeset_mode: ChangesetMode;
  author_time_window_hours: number;
  ticket_id_pattern: string | null;
  topk_edges_per_file: number | null;
  component_depth: number;
  min_component_cooccurrence: number;
  decay_half_life_days: number | null;
  hotspot_threshold: number;
  validation_mode: ValidationMode;
  max_validation_issues: number | null;
  include_extensions: string[];
  exclude_extensions: string[];
}

export interface ScanSignals {
  commit_count: number;
  total_files?: number;
  total_dirs?: number;
  languages: Record<string, number>;
  frameworks: string[];
}

export interface SmartDefaultsResult {
  config: GitAnalysisConfig;
  suggested_preset_id: string;
  reasons: string[];
}

export interface BehaviorPreset {
  id: string;
  label: string;
  group: 'recommended' | 'quality' | 'performance' | 'exploration';
  description: string;
  use_when: string;
  impact: string;
  overrides: Partial<GitAnalysisConfig>;
}

export interface FieldHelp {
  label: string;
  description: string;
  impact: string;
  when_to_use: string;
  default_value: string;
}

export type ConfigField = keyof GitAnalysisConfig;
export type ConfigIssueMap = Partial<Record<ConfigField, string[]>>;

export interface ConfigValidationResult {
  errors: string[];
  warnings: string[];
  field_errors: ConfigIssueMap;
  field_warnings: ConfigIssueMap;
}

const toInt = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const toNullableInt = (value: unknown, fallback: number | null): number | null => {
  if (value === undefined) {
    return fallback;
  }
  if (value === null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const toBool = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function addIssue(map: ConfigIssueMap, field: ConfigField, message: string): void {
  if (!map[field]) {
    map[field] = [];
  }
  map[field]?.push(message);
}

export const DEFAULT_GIT_ANALYSIS_CONFIG: GitAnalysisConfig = {
  preset_id: 'balanced',
  since: null,
  until: null,
  window_days: null,
  ref: 'HEAD',
  all_refs: false,
  skip_merge_commits: true,
  first_parent_only: false,
  find_renames_threshold: 60,
  max_changeset_size: 50,
  max_logical_changeset_size: 100,
  min_revisions: 3,
  min_cooccurrence: 3,
  changeset_mode: 'by_commit',
  author_time_window_hours: 24,
  ticket_id_pattern: null,
  topk_edges_per_file: 50,
  component_depth: 2,
  min_component_cooccurrence: 3,
  decay_half_life_days: null,
  hotspot_threshold: 50,
  validation_mode: 'soft',
  max_validation_issues: 200,
  include_extensions: [],
  exclude_extensions: [],
};

// NOTE: These presets should match the backend presets in git_analyzer/presets.py
// TODO: Remove this duplication and fetch from backend /presets endpoint (ISSUE 003, 013)
// Frontend should use getPresets() API call for single source of truth
export const BEHAVIOR_PRESETS: BehaviorPreset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    group: 'recommended',
    description: 'Reliable default for day-to-day engineering analysis.',
    use_when: 'Use for most repositories and regular team workflows.',
    impact: 'Balances signal quality and runtime without over-filtering.',
    overrides: {
      skip_merge_commits: true,
      max_changeset_size: 50,
      min_cooccurrence: 3,
      topk_edges_per_file: 50,
      changeset_mode: 'by_commit',
      validation_mode: 'soft',
    },
  },
  {
    id: 'quality',
    label: 'High Precision',
    group: 'quality',
    description: 'Reduce noisy couplings and keep only strong signals.',
    use_when: 'Use when false positives are expensive in decision making.',
    impact: 'Cleaner edges, fewer results, potentially misses weaker links.',
    overrides: {
      skip_merge_commits: true,
      max_changeset_size: 35,
      min_revisions: 5,
      min_cooccurrence: 5,
      min_component_cooccurrence: 4,
      topk_edges_per_file: 35,
      validation_mode: 'strict',
    },
  },
  {
    id: 'fast',
    label: 'Fast Feedback',
    group: 'performance',
    description: 'Prioritize speed for iterative analysis loops.',
    use_when: 'Use for very large repos or rapid local experimentation.',
    impact: 'Faster runs with lower detail and denser filtering.',
    overrides: {
      skip_merge_commits: true,
      max_changeset_size: 30,
      max_logical_changeset_size: 60,
      min_cooccurrence: 4,
      topk_edges_per_file: 25,
      max_validation_issues: 100,
    },
  },
  {
    id: 'explore',
    label: 'Exploratory',
    group: 'exploration',
    description: 'Broader capture to discover weak and emerging couplings.',
    use_when: 'Use for discovery, audits, and wide-context investigations.',
    impact: 'Richer graph with more noise and longer runtime.',
    overrides: {
      skip_merge_commits: false,
      all_refs: true,
      max_changeset_size: 80,
      min_revisions: 2,
      min_cooccurrence: 2,
      topk_edges_per_file: 80,
      validation_mode: 'permissive',
    },
  },
  {
    id: 'deep',
    label: 'Deep Analyze',
    group: 'exploration',
    description: 'Include all history and remove most caps for maximum recall.',
    use_when: 'Use for one-off deep investigations where runtime is secondary.',
    impact: 'Highest recall with the largest runtime and densest graph.',
    overrides: {
      all_refs: true,
      skip_merge_commits: false,
      max_changeset_size: null,
      max_logical_changeset_size: null,
      topk_edges_per_file: null,
      max_validation_issues: null,
      min_revisions: 1,
      min_cooccurrence: 1,
    },
  },
];

export const FIELD_HELP: Partial<Record<keyof GitAnalysisConfig, FieldHelp>> = {
  ref: {
    label: 'Branch / Tag',
    description: 'Git reference to start traversing history from.',
    impact: 'Limits analysis to a specific branch lineage.',
    when_to_use: 'Set to a release branch or tag for scoped analysis.',
    default_value: 'HEAD',
  },
  all_refs: {
    label: 'Include All Branches',
    description: 'Analyze commits across every branch and tag.',
    impact: 'Captures cross-branch coupling but increases runtime.',
    when_to_use: 'Enable for organization-wide architecture reviews.',
    default_value: 'Disabled',
  },
  skip_merge_commits: {
    label: 'Skip Merge Commits',
    description: 'Excludes merge commits from the coupling graph.',
    impact: 'Prevents inflated couplings from merge fan-in.',
    when_to_use: 'Keep enabled unless merge events carry business meaning.',
    default_value: 'Enabled',
  },
  first_parent_only: {
    label: 'First Parent Only',
    description: 'Follow only the first-parent chain (mainline history).',
    impact: 'Avoids double-counting from merged topic branches.',
    when_to_use: 'Enable in merge-heavy workflows.',
    default_value: 'Disabled',
  },
  find_renames_threshold: {
    label: 'Rename Detection (%)',
    description: 'Similarity threshold for tracking file renames.',
    impact: 'Lower detects more renames but may misclassify edits.',
    when_to_use: 'Decrease when frequent file moves are missed.',
    default_value: '60%',
  },
  since: {
    label: 'Start Date',
    description: 'Analyze commits starting from this date.',
    impact: 'Excludes older historical signals.',
    when_to_use: 'Focus on recent architecture evolution.',
    default_value: 'No lower bound',
  },
  until: {
    label: 'End Date',
    description: 'Analyze commits up to this date.',
    impact: 'Cuts off recent changes after a target date.',
    when_to_use: 'Compare historical snapshots or freeze analysis scope.',
    default_value: 'Now',
  },
  window_days: {
    label: 'Rolling Window (days)',
    description: 'Relative window from today when no start date is set.',
    impact: 'Keeps analysis focused on recent activity.',
    when_to_use: 'Use for rolling trend analysis instead of fixed dates.',
    default_value: 'None',
  },
  changeset_mode: {
    label: 'Grouping Strategy',
    description: 'How commits are grouped before counting co-changes.',
    impact: 'Changes coupling meaning from commit-level to task-level.',
    when_to_use: 'Use ticket or time modes for task-oriented teams.',
    default_value: 'By Commit',
  },
  author_time_window_hours: {
    label: 'Author Time Window (hours)',
    description: 'Groups nearby commits by the same author.',
    impact: 'Larger windows merge more commits into one changeset.',
    when_to_use: 'Increase when devs commit in small frequent bursts.',
    default_value: '24 hours',
  },
  ticket_id_pattern: {
    label: 'Ticket ID Pattern',
    description: 'Regex to extract ticket IDs from commit messages.',
    impact: 'Groups commits by ticket instead of by time.',
    when_to_use: 'Use when commits consistently reference ticket keys.',
    default_value: 'None',
  },
  max_changeset_size: {
    label: 'Max Files Per Changeset',
    description: 'Skip changesets touching more files than this.',
    impact: 'Filters out noisy cross-cutting commits.',
    when_to_use: 'Decrease for monorepos or merge-heavy histories.',
    default_value: '50 files (or Include All)',
  },
  max_logical_changeset_size: {
    label: 'Max Logical Changeset Size',
    description: 'Upper bound for grouped changesets (time/ticket modes).',
    impact: 'Prevents oversized groups from creating noisy edges.',
    when_to_use: 'Lower when using author-time or ticket grouping.',
    default_value: '100 files (or Include All)',
  },
  min_revisions: {
    label: 'Min Revisions Per File',
    description: 'Files changed fewer times than this are excluded.',
    impact: 'Removes one-off or rarely-touched files from the graph.',
    when_to_use: 'Increase to focus on actively developed files.',
    default_value: '3',
  },
  min_cooccurrence: {
    label: 'Min Co-changes',
    description: 'Minimum times two files must change together.',
    impact: 'Higher values keep only stronger coupling edges.',
    when_to_use: 'Increase when the graph is too dense to read.',
    default_value: '3',
  },
  topk_edges_per_file: {
    label: 'Top-K Edges Per File',
    description: 'Keep only the K strongest couplings per file.',
    impact: 'Controls graph density and visualization clarity.',
    when_to_use: 'Lower for cleaner views, higher for fuller context.',
    default_value: '50 (or Include All)',
  },
  decay_half_life_days: {
    label: 'Recency Decay (days)',
    description: 'Half-life for exponential recency weighting.',
    impact: 'Gives more weight to recent co-changes.',
    when_to_use: 'Enable when recent architecture drift matters most.',
    default_value: 'Disabled',
  },
  component_depth: {
    label: 'Component Depth',
    description: 'Folder depth for aggregating component couplings.',
    impact: 'Higher depth = more granular component boundaries.',
    when_to_use: 'Increase for monorepos with deep folder structure.',
    default_value: '2',
  },
  min_component_cooccurrence: {
    label: 'Min Component Co-changes',
    description: 'Minimum aggregated strength for component edges.',
    impact: 'Filters weak cross-component relationships.',
    when_to_use: 'Increase to simplify the component map.',
    default_value: '3',
  },
  hotspot_threshold: {
    label: 'Hotspot Threshold',
    description: 'Commit count above which a file is flagged as a hotspot.',
    impact: 'Directly changes hotspot counts on dashboards.',
    when_to_use: 'Tune based on your repository activity scale.',
    default_value: '50',
  },
  validation_mode: {
    label: 'Parser Strictness',
    description: 'How strictly malformed git tokens are handled.',
    impact: 'Strict improves data quality but may halt on bad data.',
    when_to_use: 'Use strict for CI pipelines, soft for exploration.',
    default_value: 'Soft',
  },
  max_validation_issues: {
    label: 'Max Diagnostics',
    description: 'Maximum parser issues stored per run.',
    impact: 'Higher values keep more diagnostics at runtime cost.',
    when_to_use: 'Increase when debugging extraction quality.',
    default_value: '200 (or Include All)',
  },
};

export const IMPORTANT_FIELDS: Array<keyof GitAnalysisConfig> = [
  'max_changeset_size',
  'min_cooccurrence',
  'changeset_mode',
  'since',
  'until',
  'skip_merge_commits',
];

export const ADVANCED_FIELDS: Array<keyof GitAnalysisConfig> = [
  'window_days',
  'ref',
  'all_refs',
  'first_parent_only',
  'find_renames_threshold',
  'author_time_window_hours',
  'ticket_id_pattern',
  'max_logical_changeset_size',
  'min_revisions',
  'topk_edges_per_file',
  'component_depth',
  'min_component_cooccurrence',
  'decay_half_life_days',
  'hotspot_threshold',
  'validation_mode',
  'max_validation_issues',
];

export interface ConfigGroup {
  id: string;
  title: string;
  description: string;
  fields: Array<keyof GitAnalysisConfig>;
}

export const CONFIG_GROUPS: ConfigGroup[] = [
  {
    id: 'git',
    title: 'Git Source',
    description: 'Branch, merge handling, and rename tracking',
    fields: ['ref', 'all_refs', 'skip_merge_commits', 'first_parent_only', 'find_renames_threshold'],
  },
  {
    id: 'commits',
    title: 'Commit Range',
    description: 'Time boundaries for analysis history',
    fields: ['since', 'until', 'window_days'],
  },
  {
    id: 'changesets',
    title: 'Changeset Grouping',
    description: 'How commits are grouped before counting co-changes',
    fields: ['changeset_mode', 'author_time_window_hours', 'ticket_id_pattern', 'max_changeset_size', 'max_logical_changeset_size'],
  },
  {
    id: 'coupling',
    title: 'Coupling Thresholds',
    description: 'Signal strength filters for coupling edges',
    fields: ['min_revisions', 'min_cooccurrence', 'topk_edges_per_file', 'decay_half_life_days'],
  },
  {
    id: 'components',
    title: 'Components & Hotspots',
    description: 'Aggregation depth and hotspot detection',
    fields: ['component_depth', 'min_component_cooccurrence', 'hotspot_threshold'],
  },
  {
    id: 'validation',
    title: 'Validation',
    description: 'Parser strictness and diagnostics',
    fields: ['validation_mode', 'max_validation_issues'],
  },
];

export function normalizeGitAnalysisConfig(
  input: Partial<GitAnalysisConfig> | null | undefined,
): GitAnalysisConfig {
  const raw = input ?? {};
  const mode = raw.changeset_mode;
  const validation = raw.validation_mode;

  const normalized: GitAnalysisConfig = {
    preset_id: typeof raw.preset_id === 'string' && raw.preset_id ? raw.preset_id : DEFAULT_GIT_ANALYSIS_CONFIG.preset_id,
    since: toStringOrNull(raw.since),
    until: toStringOrNull(raw.until),
    window_days: toNullableInt(raw.window_days, DEFAULT_GIT_ANALYSIS_CONFIG.window_days),
    ref: typeof raw.ref === 'string' && raw.ref.trim() ? raw.ref.trim() : DEFAULT_GIT_ANALYSIS_CONFIG.ref,
    all_refs: toBool(raw.all_refs, DEFAULT_GIT_ANALYSIS_CONFIG.all_refs),
    skip_merge_commits: toBool(raw.skip_merge_commits, DEFAULT_GIT_ANALYSIS_CONFIG.skip_merge_commits),
    first_parent_only: toBool(raw.first_parent_only, DEFAULT_GIT_ANALYSIS_CONFIG.first_parent_only),
    find_renames_threshold: toInt(raw.find_renames_threshold, DEFAULT_GIT_ANALYSIS_CONFIG.find_renames_threshold),
    max_changeset_size: toNullableInt(raw.max_changeset_size, DEFAULT_GIT_ANALYSIS_CONFIG.max_changeset_size),
    max_logical_changeset_size: toNullableInt(raw.max_logical_changeset_size, DEFAULT_GIT_ANALYSIS_CONFIG.max_logical_changeset_size),
    min_revisions: toInt(raw.min_revisions, DEFAULT_GIT_ANALYSIS_CONFIG.min_revisions),
    min_cooccurrence: toInt(raw.min_cooccurrence, DEFAULT_GIT_ANALYSIS_CONFIG.min_cooccurrence),
    changeset_mode: mode === 'by_author_time' || mode === 'by_ticket_id' || mode === 'by_commit'
      ? mode
      : DEFAULT_GIT_ANALYSIS_CONFIG.changeset_mode,
    author_time_window_hours: toInt(raw.author_time_window_hours, DEFAULT_GIT_ANALYSIS_CONFIG.author_time_window_hours),
    ticket_id_pattern: toStringOrNull(raw.ticket_id_pattern),
    topk_edges_per_file: toNullableInt(raw.topk_edges_per_file, DEFAULT_GIT_ANALYSIS_CONFIG.topk_edges_per_file),
    component_depth: toInt(raw.component_depth, DEFAULT_GIT_ANALYSIS_CONFIG.component_depth),
    min_component_cooccurrence: toInt(raw.min_component_cooccurrence, DEFAULT_GIT_ANALYSIS_CONFIG.min_component_cooccurrence),
    decay_half_life_days: toNullableInt(raw.decay_half_life_days, DEFAULT_GIT_ANALYSIS_CONFIG.decay_half_life_days),
    hotspot_threshold: toInt(raw.hotspot_threshold, DEFAULT_GIT_ANALYSIS_CONFIG.hotspot_threshold),
    validation_mode: validation === 'strict' || validation === 'permissive' || validation === 'soft'
      ? validation
      : DEFAULT_GIT_ANALYSIS_CONFIG.validation_mode,
    max_validation_issues: toNullableInt(raw.max_validation_issues, DEFAULT_GIT_ANALYSIS_CONFIG.max_validation_issues),
    include_extensions: Array.isArray(raw.include_extensions) ? raw.include_extensions : DEFAULT_GIT_ANALYSIS_CONFIG.include_extensions,
    exclude_extensions: Array.isArray(raw.exclude_extensions) ? raw.exclude_extensions : DEFAULT_GIT_ANALYSIS_CONFIG.exclude_extensions,
  };

  normalized.find_renames_threshold = Math.max(1, Math.min(100, normalized.find_renames_threshold));
  if (normalized.max_changeset_size !== null) normalized.max_changeset_size = Math.max(2, normalized.max_changeset_size);
  if (normalized.max_logical_changeset_size !== null) normalized.max_logical_changeset_size = Math.max(2, normalized.max_logical_changeset_size);
  normalized.min_revisions = Math.max(1, normalized.min_revisions);
  normalized.min_cooccurrence = Math.max(1, normalized.min_cooccurrence);
  normalized.author_time_window_hours = Math.max(1, normalized.author_time_window_hours);
  if (normalized.topk_edges_per_file !== null) normalized.topk_edges_per_file = Math.max(1, normalized.topk_edges_per_file);
  normalized.component_depth = Math.max(1, normalized.component_depth);
  normalized.min_component_cooccurrence = Math.max(1, normalized.min_component_cooccurrence);
  normalized.hotspot_threshold = Math.max(1, normalized.hotspot_threshold);
  if (normalized.max_validation_issues !== null) normalized.max_validation_issues = Math.max(1, normalized.max_validation_issues);
  if (normalized.window_days !== null) normalized.window_days = Math.max(1, normalized.window_days);
  if (normalized.decay_half_life_days !== null) normalized.decay_half_life_days = Math.max(1, normalized.decay_half_life_days);

  return normalized;
}

function suggestPresetFromSignals(scan: ScanSignals): SmartDefaultsResult['suggested_preset_id'] {
  if (scan.commit_count > 100000) {
    return 'fast';
  }

  const frameworks = new Set(scan.frameworks.map((item) => item.toLowerCase()));
  const languages = Object.keys(scan.languages).map((item) => item.toLowerCase());

  if (frameworks.has('fastapi') || frameworks.has('django')) {
    return 'quality';
  }

  if (frameworks.has('react') || frameworks.has('nextjs') || languages.includes('typescript')) {
    return 'balanced';
  }

  if (languages.length >= 4) {
    return 'explore';
  }

  return 'balanced';
}

export function computeSmartDefaultsFromScan(
  scan: ScanSignals,
  base: GitAnalysisConfig = DEFAULT_GIT_ANALYSIS_CONFIG,
): SmartDefaultsResult {
  const reasons: string[] = [];
  const next = normalizeGitAnalysisConfig(base);

  if (scan.commit_count < 1000) {
    next.min_revisions = 2;
    next.min_cooccurrence = 2;
    reasons.push('Small history detected: lowered revision/co-occurrence thresholds for recall.');
  }

  if (scan.commit_count > 100000) {
    next.max_changeset_size = 30;
    next.decay_half_life_days = 365;
    reasons.push('Large history detected: capped changeset size and enabled recency decay.');
  }

  if (scan.commit_count > 500000) {
    next.window_days = 730;
    reasons.push('Very large history detected: constrained analysis to a rolling two-year window.');
  }

  const suggestedPreset = suggestPresetFromSignals(scan);
  next.preset_id = suggestedPreset;

  if (reasons.length === 0) {
    reasons.push('Default thresholds match the scanned repository profile.');
  }

  return {
    config: next,
    suggested_preset_id: suggestedPreset,
    reasons,
  };
}

export function applyBehaviorPreset(
  current: GitAnalysisConfig,
  presetId: string,
): GitAnalysisConfig {
  const preset = BEHAVIOR_PRESETS.find((item) => item.id === presetId);
  if (!preset) return current;
  return normalizeGitAnalysisConfig({
    ...current,
    ...preset.overrides,
    preset_id: preset.id,
  });
}

export function validateGitAnalysisConfig(config: GitAnalysisConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors: ConfigIssueMap = {};
  const fieldWarnings: ConfigIssueMap = {};

  if (config.since && config.until && config.since > config.until) {
    const message = 'Since date must be earlier than or equal to Until date.';
    errors.push(message);
    addIssue(fieldErrors, 'since', message);
    addIssue(fieldErrors, 'until', message);
  }

  if (config.changeset_mode === 'by_ticket_id' && !config.ticket_id_pattern) {
    const message = 'Ticket ID pattern is required when changeset mode is by_ticket_id.';
    errors.push(message);
    addIssue(fieldErrors, 'changeset_mode', message);
    addIssue(fieldErrors, 'ticket_id_pattern', message);
  }

  if (config.changeset_mode === 'by_author_time' && config.author_time_window_hours < 1) {
    const message = 'Author time window must be at least 1 hour.';
    errors.push(message);
    addIssue(fieldErrors, 'author_time_window_hours', message);
  }

  if (config.first_parent_only && config.skip_merge_commits) {
    const message = 'First-parent has little effect when merge commits are skipped.';
    warnings.push(message);
    addIssue(fieldWarnings, 'first_parent_only', message);
    addIssue(fieldWarnings, 'skip_merge_commits', message);
  }

  if (config.window_days && config.since) {
    const message = 'Since date takes precedence over Window Days.';
    warnings.push(message);
    addIssue(fieldWarnings, 'window_days', message);
    addIssue(fieldWarnings, 'since', message);
  }

  if (config.all_refs && config.ref !== 'HEAD') {
    const message = 'Ref is ignored when all_refs is enabled.';
    warnings.push(message);
    addIssue(fieldWarnings, 'all_refs', message);
    addIssue(fieldWarnings, 'ref', message);
  }

  if (config.decay_half_life_days !== null && config.decay_half_life_days < 7) {
    const message = 'Decay half-life below 7 days may over-weight recency.';
    warnings.push(message);
    addIssue(fieldWarnings, 'decay_half_life_days', message);
  }

  return {
    errors,
    warnings,
    field_errors: fieldErrors,
    field_warnings: fieldWarnings,
  };
}

export function buildGitAnalyzerRunConfig(config: GitAnalysisConfig): Record<string, unknown> {
  const normalized = normalizeGitAnalysisConfig(config);
  const payload: Record<string, unknown> = {
    max_changeset_size: normalized.max_changeset_size,
    max_logical_changeset_size: normalized.max_logical_changeset_size,
    min_revisions: normalized.min_revisions,
    min_cooccurrence: normalized.min_cooccurrence,
    changeset_mode: normalized.changeset_mode,
    author_time_window_hours: normalized.author_time_window_hours,
    topk_edges_per_file: normalized.topk_edges_per_file,
    component_depth: normalized.component_depth,
    min_component_cooccurrence: normalized.min_component_cooccurrence,
    hotspot_threshold: normalized.hotspot_threshold,
    skip_merge_commits: normalized.skip_merge_commits,
    first_parent_only: normalized.first_parent_only,
    ref: normalized.ref,
    all_refs: normalized.all_refs,
    find_renames_threshold: normalized.find_renames_threshold,
    max_validation_issues: normalized.max_validation_issues,
    validation_mode: normalized.validation_mode,
    include_extensions: normalized.include_extensions || [],
    exclude_extensions: normalized.exclude_extensions || [],
  };

  if (normalized.since) payload.since = normalized.since;
  if (normalized.until) payload.until = normalized.until;
  if (normalized.window_days !== null) payload.window_days = normalized.window_days;
  if (normalized.decay_half_life_days !== null) payload.decay_half_life_days = normalized.decay_half_life_days;
  if (normalized.ticket_id_pattern) payload.ticket_id_pattern = normalized.ticket_id_pattern;

  return payload;
}
