import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Info, AlertTriangle } from 'lucide-react';
import {
// TODO (ISSUE 002): When slider is at boundary, set to null instead of boundary date
// TODO (ISSUE 017): Auto-change preset_id to 'custom' when user manually edits fields
    applyBehaviorPreset,
    BEHAVIOR_PRESETS,
    CONFIG_GROUPS,
    DEFAULT_GIT_ANALYSIS_CONFIG,
    FIELD_HELP,
    validateGitAnalysisConfig,
    normalizeGitAnalysisConfig,
} from './gitAnalysisConfig';
import type { ConfigValidationResult, GitAnalysisConfig } from './gitAnalysisConfig';
import RefSelector from '../../shared/RefSelector';

interface GitAnalysisConfiguratorProps {
    value: GitAnalysisConfig;
    onChange: (next: GitAnalysisConfig) => void;
    onValidationChange?: (result: ConfigValidationResult) => void;
    /** Repository ID for lazy-loading refs */
    repoId?: string | null;
    /** Last commit date from scan, used as range slider max */
    lastCommitDate?: string | null;
    /** First commit date from scan, used as range slider reference */
    firstCommitDate?: string | null;
}

interface CommitRangeUpdate {
    since?: string | null;
    until?: string | null;
    windowDays?: number | null;
}

const PRESET_ORDER = ['recommended', 'quality', 'performance', 'exploration'];

export default function GitAnalysisConfigurator({
    value,
    onChange,
    onValidationChange,
    repoId,
    lastCommitDate,
    firstCommitDate,
}: GitAnalysisConfiguratorProps) {
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['commits', 'changesets']));

    const validation = useMemo(() => validateGitAnalysisConfig(value), [value]);

    useEffect(() => {
        onValidationChange?.(validation);
    }, [onValidationChange, validation]);

    const updateField = <K extends keyof GitAnalysisConfig>(key: K, fieldValue: GitAnalysisConfig[K]) => {
        onChange(normalizeGitAnalysisConfig({ ...value, [key]: fieldValue }));
    };

    const applyPreset = (presetId: string) => {
        onChange(applyBehaviorPreset(value, presetId));
    };

    const resetToDefault = () => {
        onChange(DEFAULT_GIT_ANALYSIS_CONFIG);
    };

    const toggleGroup = (id: string) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const presetGroups = PRESET_ORDER
        .map((group) => ({
            group,
            items: BEHAVIOR_PRESETS.filter((item) => item.group === group),
        }))
        .filter((entry) => entry.items.length > 0);

    const fieldErrors = <K extends keyof GitAnalysisConfig>(field: K): string[] => (
        validation.field_errors[field] ?? []
    );

    const fieldWarnings = <K extends keyof GitAnalysisConfig>(field: K): string[] => (
        validation.field_warnings[field] ?? []
    );

    const updateCommitRange = (update: CommitRangeUpdate) => {
        const patch: Partial<GitAnalysisConfig> = {};
        if ('since' in update) patch.since = update.since ?? null;
        if ('until' in update) patch.until = update.until ?? null;
        if ('windowDays' in update) patch.window_days = update.windowDays ?? null;
        onChange(normalizeGitAnalysisConfig({ ...value, ...patch }));
    };

    return (
        <div className="space-y-5">
            {/* Presets */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Analysis Presets</h3>
                <button
                    type="button"
                    onClick={resetToDefault}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    Reset all
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {presetGroups.flatMap((entry) =>
                    entry.items.map((preset) => {
                        const selected = value.preset_id === preset.id;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset.id)}
                                className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                                    selected
                                        ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                                }`}
                                title={preset.description}
                            >
                                {preset.label}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Config Groups */}
            {CONFIG_GROUPS.map((group) => {
                const isOpen = openGroups.has(group.id);
                return (
                    <div key={group.id} className="rounded-lg border border-slate-800 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
                        >
                            {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-slate-200">{group.title}</span>
                                <span className="ml-2 text-xs text-slate-500">{group.description}</span>
                            </div>
                        </button>

                        {isOpen && (
                            <div className="p-3 space-y-3 bg-slate-950/30">
                                {group.id === 'commits' && (
                                    <CommitRangeSection
                                        since={value.since}
                                        until={value.until}
                                        windowDays={value.window_days}
                                        onRangeChange={updateCommitRange}
                                        lastCommitDate={lastCommitDate ?? null}
                                        firstCommitDate={firstCommitDate ?? null}
                                        sinceErrors={fieldErrors('since')}
                                        sinceWarnings={fieldWarnings('since')}
                                        untilErrors={fieldErrors('until')}
                                        untilWarnings={fieldWarnings('until')}
                                        windowDaysErrors={fieldErrors('window_days')}
                                        windowDaysWarnings={fieldWarnings('window_days')}
                                    />
                                )}

                                {group.id !== 'commits' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        {group.fields.map((field) => (
                                            <ConfigFieldRenderer
                                                key={field}
                                                field={field}
                                                value={value}
                                                onChange={updateField}
                                                errors={fieldErrors(field)}
                                                warnings={fieldWarnings(field)}
                                                repoId={repoId ?? null}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Validation summary */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
                        <AlertTriangle size={14} />
                        Configuration Issues
                    </div>
                    {validation.errors.map((message) => (
                        <p key={`err:${message}`} className="text-xs text-red-300">{message}</p>
                    ))}
                    {validation.warnings.map((message) => (
                        <p key={`warn:${message}`} className="text-xs text-amber-200">{message}</p>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Commit Range with date slider ─── */

const DAY_MS = 86400000;

function dateToNumber(dateStr: string): number {
    const n = new Date(dateStr).getTime();
    return Number.isFinite(n) ? n : 0;
}

function numberToDate(num: number): string {
    return new Date(num).toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

interface CommitRangeSectionProps {
    since: string | null;
    until: string | null;
    windowDays: number | null;
    onRangeChange: (update: CommitRangeUpdate) => void;
    lastCommitDate: string | null;
    firstCommitDate: string | null;
    sinceErrors: string[];
    sinceWarnings: string[];
    untilErrors: string[];
    untilWarnings: string[];
    windowDaysErrors: string[];
    windowDaysWarnings: string[];
}

function CommitRangeSection({
    since,
    until,
    windowDays,
    onRangeChange,
    lastCommitDate,
    firstCommitDate,
    sinceErrors,
    sinceWarnings,
    untilErrors,
    untilWarnings,
    windowDaysErrors,
    windowDaysWarnings,
}: CommitRangeSectionProps) {
    const today = dateToNumber(numberToDate(Date.now()));
    const parsedFirst = firstCommitDate ? dateToNumber(firstCommitDate) : null;
    const parsedLast = lastCommitDate ? dateToNumber(lastCommitDate) : null;

    let rangeMin = parsedFirst ?? dateToNumber('2015-01-01');
    let rangeMax = parsedLast ?? today;
    let usesFallbackBounds = false;

    if (rangeMax <= rangeMin) {
        usesFallbackBounds = true;
        rangeMax = today;
        rangeMin = rangeMax - 365 * DAY_MS;
    }

    const sinceNum = since ? clamp(dateToNumber(since), rangeMin, rangeMax) : rangeMin;
    const untilNum = until ? clamp(dateToNumber(until), sinceNum, rangeMax) : rangeMax;
    const span = Math.max(DAY_MS, rangeMax - rangeMin);

    const applyCustomRange = (nextSince: string, nextUntil: string) => {
        onRangeChange({ windowDays: null, since: nextSince, until: nextUntil });
    };

    const handleSliderSinceChange = (num: number) => {
        const boundedSince = clamp(num, rangeMin, untilNum);
        applyCustomRange(numberToDate(boundedSince), numberToDate(untilNum));
    };

    const handleSliderUntilChange = (num: number) => {
        const boundedUntil = clamp(num, sinceNum, rangeMax);
        applyCustomRange(numberToDate(sinceNum), numberToDate(boundedUntil));
    };

    const handleSinceInput = (next: string | null) => {
        if (!next) {
            onRangeChange({ since: null, windowDays: null });
            return;
        }
        const nextSinceNum = clamp(dateToNumber(next), rangeMin, rangeMax);
        if (!until) {
            onRangeChange({ windowDays: null, since: numberToDate(nextSinceNum) });
            return;
        }
        const adjustedUntilNum = Math.max(untilNum, nextSinceNum);
        applyCustomRange(numberToDate(nextSinceNum), numberToDate(adjustedUntilNum));
    };

    const handleUntilInput = (next: string | null) => {
        if (!next) {
            onRangeChange({ until: null, windowDays: null });
            return;
        }
        const nextUntilNum = clamp(dateToNumber(next), rangeMin, rangeMax);
        if (!since) {
            onRangeChange({ windowDays: null, until: numberToDate(nextUntilNum) });
            return;
        }
        const adjustedSinceNum = Math.min(sinceNum, nextUntilNum);
        applyCustomRange(numberToDate(adjustedSinceNum), numberToDate(nextUntilNum));
    };

    const handleWindowDaysInput = (next: number | null) => {
        if (next !== null) {
            onRangeChange({ windowDays: next, since: null, until: null });
            return;
        }
        onRangeChange({ windowDays: null });
    };

    const applyQuickWindow = (days: number | null) => {
        onRangeChange({ since: null, until: null, windowDays: days });
    };

    const applyAllHistory = () => {
        onRangeChange({ since: null, until: null, windowDays: null });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={applyAllHistory}
                    className={`rounded-md px-2.5 py-1 text-xs border transition-colors ${
                        windowDays === null && !since && !until
                            ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                            : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                >
                    All History
                </button>
                {[30, 90, 365].map((days) => (
                    <button
                        key={days}
                        type="button"
                        onClick={() => applyQuickWindow(days)}
                        className={`rounded-md px-2.5 py-1 text-xs border transition-colors ${
                            windowDays === days
                                ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                                : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                        }`}
                    >
                        Last {days}d
                    </button>
                ))}
                <span className="text-[11px] text-slate-500">
                    {windowDays !== null ? `Using rolling window: ${windowDays} days` : (since || until ? 'Using explicit date range' : 'No date limits')}
                </span>
            </div>

            {/* Range slider */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{firstCommitDate ?? numberToDate(rangeMin)}</span>
                    <span className="text-slate-400 font-medium">Commit Date Range</span>
                    <span>{lastCommitDate ?? numberToDate(rangeMax)}</span>
                </div>
                {usesFallbackBounds && (
                    <p className="text-[11px] text-amber-300">
                        Scan date bounds were unavailable or invalid. Using a safe adjustable range.
                    </p>
                )}
                <div className="relative h-8 flex items-center">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-800" />
                    <div
                        className="absolute h-1.5 rounded-full bg-sky-500/40"
                        style={{
                            left: `${((sinceNum - rangeMin) / span) * 100}%`,
                            right: `${100 - ((untilNum - rangeMin) / span) * 100}%`,
                        }}
                    />
                    <input
                        type="range"
                        min={rangeMin}
                        max={rangeMax}
                        step={DAY_MS}
                        value={sinceNum}
                        onChange={(e) => handleSliderSinceChange(Number(e.target.value))}
                        className="absolute inset-x-0 h-8 appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-sky-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-900 [&::-moz-range-thumb]:cursor-pointer"
                        style={{ zIndex: 2 }}
                    />
                    <input
                        type="range"
                        min={rangeMin}
                        max={rangeMax}
                        step={DAY_MS}
                        value={untilNum}
                        onChange={(e) => handleSliderUntilChange(Number(e.target.value))}
                        className="absolute inset-x-0 h-8 appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-900 [&::-moz-range-thumb]:cursor-pointer"
                        style={{ zIndex: 3 }}
                    />
                </div>
            </div>

            {/* Manual date inputs synced with slider */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <FieldCard
                    help={FIELD_HELP.since}
                    errors={sinceErrors}
                    warnings={sinceWarnings}
                >
                    <input
                        type="date"
                        value={since ?? ''}
                        min={numberToDate(rangeMin)}
                        max={until ?? numberToDate(rangeMax)}
                        onChange={(e) => handleSinceInput(e.target.value || null)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                    />
                </FieldCard>

                <FieldCard
                    help={FIELD_HELP.until}
                    errors={untilErrors}
                    warnings={untilWarnings}
                >
                    <input
                        type="date"
                        value={until ?? ''}
                        min={since ?? numberToDate(rangeMin)}
                        max={numberToDate(rangeMax)}
                        onChange={(e) => handleUntilInput(e.target.value || null)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                    />
                </FieldCard>

                <NumericOrEmptyField
                    value={windowDays}
                    onChange={handleWindowDaysInput}
                    min={1}
                    help={FIELD_HELP.window_days}
                    errors={windowDaysErrors}
                    warnings={windowDaysWarnings}
                />
            </div>
        </div>
    );
}

/* ─── Generic field renderer ─── */

function ConfigFieldRenderer<K extends keyof GitAnalysisConfig>({
    field,
    value,
    onChange,
    errors,
    warnings,
    repoId,
}: {
    field: K;
    value: GitAnalysisConfig;
    onChange: <F extends keyof GitAnalysisConfig>(key: F, val: GitAnalysisConfig[F]) => void;
    errors: string[];
    warnings: string[];
    repoId: string | null;
}) {
    const help = FIELD_HELP[field];
    const val = value[field];

    if (field === 'changeset_mode') {
        return (
            <FieldCard help={help} errors={errors} warnings={warnings}>
                <select
                    value={val as string}
                    onChange={(e) => onChange('changeset_mode', e.target.value as GitAnalysisConfig['changeset_mode'])}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                    <option value="by_commit">By Commit</option>
                    <option value="by_author_time">By Author Time Window</option>
                    <option value="by_ticket_id">By Ticket ID</option>
                </select>
            </FieldCard>
        );
    }

    if (field === 'validation_mode') {
        return (
            <FieldCard help={help} errors={errors} warnings={warnings}>
                <select
                    value={val as string}
                    onChange={(e) => onChange('validation_mode', e.target.value as GitAnalysisConfig['validation_mode'])}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                >
                    <option value="strict">Strict</option>
                    <option value="soft">Soft</option>
                    <option value="permissive">Permissive</option>
                </select>
            </FieldCard>
        );
    }

    if (field === 'ticket_id_pattern') {
        if (value.changeset_mode !== 'by_ticket_id') return null;
        return (
            <FieldCard help={help} errors={errors} warnings={warnings}>
                <input
                    type="text"
                    placeholder="([A-Z]+-\\d+)"
                    value={(val as string | null) ?? ''}
                    onChange={(e) => onChange('ticket_id_pattern', e.target.value || null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
                />
            </FieldCard>
        );
    }

    if (field === 'author_time_window_hours') {
        if (value.changeset_mode !== 'by_author_time') return null;
        return (
            <NumericField
                value={val as number}
                onChange={(v) => onChange('author_time_window_hours', v)}
                step={1}
                min={1}
                help={help}
                errors={errors}
                warnings={warnings}
            />
        );
    }

    if (field === 'ref') {
        if (value.all_refs) return null;
        return (
            <FieldCard help={help} errors={errors} warnings={warnings}>
                <RefSelector
                    repoId={repoId}
                    value={val as string}
                    onChange={(v) => onChange('ref', v)}
                />
            </FieldCard>
        );
    }

    if (typeof val === 'boolean') {
        return (
            <BooleanField
                value={val}
                onChange={(v) => onChange(field, v as GitAnalysisConfig[K])}
                help={help}
                errors={errors}
                warnings={warnings}
            />
        );
    }

    if (field === 'max_logical_changeset_size' && value.changeset_mode === 'by_commit') {
        return null;
    }

    if (
        field === 'max_changeset_size'
        || field === 'max_logical_changeset_size'
        || field === 'topk_edges_per_file'
        || field === 'max_validation_issues'
    ) {
        const mins: Partial<Record<string, number>> = {
            max_changeset_size: 2,
            max_logical_changeset_size: 2,
            topk_edges_per_file: 1,
            max_validation_issues: 1,
        };
        return (
            <NumericWithIncludeAllField
                value={(val as number | null) ?? null}
                onChange={(v) => onChange(field, v as GitAnalysisConfig[K])}
                min={mins[field as string]}
                step={field === 'max_validation_issues' ? 10 : 1}
                help={help}
                errors={errors}
                warnings={warnings}
            />
        );
    }

    if (field === 'window_days' || field === 'decay_half_life_days') {
        return (
            <NumericOrEmptyField
                value={val as number | null}
                onChange={(v) => onChange(field, v as GitAnalysisConfig[K])}
                min={1}
                help={help}
                errors={errors}
                warnings={warnings}
            />
        );
    }

    if (typeof val === 'number') {
        const mins: Partial<Record<string, number>> = {
            find_renames_threshold: 1,
            min_revisions: 1,
            min_cooccurrence: 1,
            component_depth: 1,
            min_component_cooccurrence: 1,
            hotspot_threshold: 1,
            author_time_window_hours: 1,
        };
        const maxes: Partial<Record<string, number>> = {
            find_renames_threshold: 100,
        };
        return (
            <NumericField
                value={val}
                onChange={(v) => onChange(field, v as GitAnalysisConfig[K])}
                step={1}
                min={mins[field as string]}
                max={maxes[field as string]}
                help={help}
                errors={errors}
                warnings={warnings}
            />
        );
    }

    return null;
}

/* ─── Field Components ─── */

function FieldCard({
    help,
    errors,
    warnings,
    children,
}: {
    help?: {
        label: string;
        description: string;
        impact: string;
        when_to_use: string;
        default_value: string;
    };
    errors?: string[];
    warnings?: string[];
    children: ReactNode;
}) {
    const hasErrors = (errors?.length ?? 0) > 0;
    return (
        <div className={`rounded-lg border p-2.5 ${hasErrors ? 'border-red-500/50 bg-red-500/5' : 'border-slate-800/60 bg-slate-900/30'}`}>
            {help && (
                <div className="mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-slate-300">{help.label}</p>
                        <span title={`${help.when_to_use} Default: ${help.default_value}`}>
                            <Info size={12} className="text-slate-600" />
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{help.description}</p>
                </div>
            )}
            {children}
            {errors && errors.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                    {errors.map((message) => (
                        <p key={message} className="text-[11px] text-red-300">{message}</p>
                    ))}
                </div>
            )}
            {warnings && warnings.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                    {warnings.map((message) => (
                        <p key={message} className="text-[11px] text-amber-200">{message}</p>
                    ))}
                </div>
            )}
        </div>
    );
}

function NumericField({
    value,
    onChange,
    help,
    errors,
    warnings,
    min,
    max,
    step,
}: {
    value: number;
    onChange: (value: number) => void;
    help?: {
        label: string;
        description: string;
        impact: string;
        when_to_use: string;
        default_value: string;
    };
    errors?: string[];
    warnings?: string[];
    min?: number;
    max?: number;
    step?: number;
}) {
    return (
        <FieldCard help={help} errors={errors} warnings={warnings}>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
            />
        </FieldCard>
    );
}

function NumericOrEmptyField({
    value,
    onChange,
    help,
    errors,
    warnings,
    min,
}: {
    value: number | null;
    onChange: (value: number | null) => void;
    help?: {
        label: string;
        description: string;
        impact: string;
        when_to_use: string;
        default_value: string;
    };
    errors?: string[];
    warnings?: string[];
    min?: number;
}) {
    return (
        <FieldCard help={help} errors={errors} warnings={warnings}>
            <input
                type="number"
                value={value ?? ''}
                min={min}
                onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="Disabled"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
            />
        </FieldCard>
    );
}

function NumericWithIncludeAllField({
    value,
    onChange,
    help,
    errors,
    warnings,
    min,
    step,
}: {
    value: number | null;
    onChange: (value: number | null) => void;
    help?: {
        label: string;
        description: string;
        impact: string;
        when_to_use: string;
        default_value: string;
    };
    errors?: string[];
    warnings?: string[];
    min?: number;
    step?: number;
}) {
    return (
        <FieldCard help={help} errors={errors} warnings={warnings}>
            <div className="space-y-2">
                <input
                    type="number"
                    value={value ?? ''}
                    min={min}
                    step={step}
                    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="Include all"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                    <input
                        type="checkbox"
                        checked={value === null}
                        onChange={(e) => {
                            if (e.target.checked) {
                                onChange(null);
                            } else if (value === null) {
                                onChange(min ?? 1);
                            }
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-sky-500"
                    />
                    Include all (no cap)
                </label>
            </div>
        </FieldCard>
    );
}

function BooleanField({
    value,
    onChange,
    help,
    errors,
    warnings,
}: {
    value: boolean;
    onChange: (value: boolean) => void;
    help?: {
        label: string;
        description: string;
        impact: string;
        when_to_use: string;
        default_value: string;
    };
    errors?: string[];
    warnings?: string[];
}) {
    return (
        <FieldCard help={help} errors={errors} warnings={warnings}>
            <label className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-1.5 cursor-pointer">
                <span className="text-xs text-slate-400">{value ? 'Enabled' : 'Disabled'}</span>
                <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-sky-500"
                />
            </label>
        </FieldCard>
    );
}
