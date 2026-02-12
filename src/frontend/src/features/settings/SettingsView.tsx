/**
 * Settings View
 * 
 * Comprehensive settings panel for analysis configuration, performance tuning,
 * and application preferences.
 */

import { useState, useEffect } from 'react';
import {
    Settings2, GitBranch, Cpu, Palette, Keyboard,
    Save, RefreshCw, AlertCircle, CheckCircle, Info,
    Sliders, Monitor, Moon, Sun
} from 'lucide-react';
import { type RepoInfo } from '../../api/repos';
import { updateGitInfo, type GitRemoteInfo, getGitInfo } from '../../api/git';
import {
    createAnalysisConfig,
    listAnalysisConfigs,
    updateAnalysisConfig,
} from '../../api/analysis';
import { AnalysisConfigurator as GitAnalysisConfigurator } from '../analysis-configurator';
import {
    buildGitAnalyzerRunConfig,
    DEFAULT_GIT_ANALYSIS_CONFIG,
    type GitAnalysisConfig,
    normalizeGitAnalysisConfig,
} from './gitAnalysisConfig';

interface SettingsViewProps {
    repo: RepoInfo;
}

interface DisplaySettings {
    theme: 'dark' | 'light' | 'system';
    compactMode: boolean;
    showLineNumbers: boolean;
    syntaxHighlighting: boolean;
    dateFormat: 'relative' | 'absolute' | 'iso';
    defaultView: 'graph' | 'tree' | 'dashboard';
}

interface NotificationSettings {
    analysisComplete: boolean;
    hotspotAlerts: boolean;
    couplingThresholdAlerts: boolean;
    couplingAlertThreshold: number;
}

interface PerformanceSettings {
    virtualScrolling: boolean;
    graphSampling: boolean;
    maxNodesInGraph: number;
    lazyLoadThreshold: number;
    enableAnimations: boolean;
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
    theme: 'dark',
    compactMode: false,
    showLineNumbers: true,
    syntaxHighlighting: true,
    dateFormat: 'relative',
    defaultView: 'graph',
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    analysisComplete: true,
    hotspotAlerts: true,
    couplingThresholdAlerts: false,
    couplingAlertThreshold: 70,
};

const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
    virtualScrolling: true,
    graphSampling: true,
    maxNodesInGraph: 100,
    lazyLoadThreshold: 500,
    enableAnimations: true,
};

export function SettingsView({ repo }: SettingsViewProps) {
    const [activeSection, setActiveSection] = useState<string>('analysis');
    const [analysisSettings, setAnalysisSettings] = useState<GitAnalysisConfig>(DEFAULT_GIT_ANALYSIS_CONFIG);
    const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
    const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>(DEFAULT_PERFORMANCE_SETTINGS);
    const [gitInfo, setGitInfo] = useState<GitRemoteInfo | null>(null);
    const [gitWebUrl, setGitWebUrl] = useState('');
    const [gitDefaultBranch, setGitDefaultBranch] = useState('main');
    const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const info = await getGitInfo(repo.id);
                setGitInfo(info);
                setGitWebUrl(info.git_web_url || '');
                setGitDefaultBranch(info.git_default_branch || 'main');
            } catch (e) {
                console.error('Failed to load git info:', e);
            }

            // Load UI preferences from localStorage
            const savedDisplay = localStorage.getItem('settings-display');
            const savedNotifications = localStorage.getItem('settings-notifications');
            const savedPerformance = localStorage.getItem('settings-performance');

            if (savedDisplay) setDisplaySettings(JSON.parse(savedDisplay));
            if (savedNotifications) setNotificationSettings(JSON.parse(savedNotifications));
            if (savedPerformance) setPerformanceSettings(JSON.parse(savedPerformance));

            try {
                const configs = await listAnalysisConfigs(repo.id);
                const active = configs.find((config) => config.is_active) ?? configs[0] ?? null;
                if (!active) {
                    setActiveConfigId(null);
                    setAnalysisSettings(DEFAULT_GIT_ANALYSIS_CONFIG);
                    return;
                }

                setActiveConfigId(active.id);
                const normalized = normalizeGitAnalysisConfig({
                    ...DEFAULT_GIT_ANALYSIS_CONFIG,
                    ...(active.config as Partial<GitAnalysisConfig>),
                    preset_id: active.preset_id ?? 'custom',
                });
                setAnalysisSettings(normalized);
            } catch (error) {
                console.error('Failed to load analysis config:', error);
                setActiveConfigId(null);
                setAnalysisSettings(DEFAULT_GIT_ANALYSIS_CONFIG);
            }
        };
        loadSettings();
    }, [repo.id]);

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save git info
            await updateGitInfo(repo.id, {
                git_web_url: gitWebUrl || null,
                git_default_branch: gitDefaultBranch,
            });

            const runConfig = buildGitAnalyzerRunConfig(analysisSettings);
            const presetId = analysisSettings.preset_id === 'custom'
                ? null
                : analysisSettings.preset_id;
            const configName = `${repo.name} Settings`;

            if (activeConfigId) {
                const updated = await updateAnalysisConfig(repo.id, activeConfigId, {
                    name: configName,
                    description: 'Saved from settings',
                    preset_id: presetId,
                    config: runConfig,
                    include_patterns: [],
                    exclude_patterns: [],
                    is_active: true,
                });
                setActiveConfigId(updated.id);
            } else {
                const created = await createAnalysisConfig(repo.id, {
                    name: configName,
                    description: 'Saved from settings',
                    preset_id: presetId,
                    config: runConfig,
                    include_patterns: [],
                    exclude_patterns: [],
                    is_active: true,
                });
                setActiveConfigId(created.id);
            }

            localStorage.setItem('settings-display', JSON.stringify(displaySettings));
            localStorage.setItem('settings-notifications', JSON.stringify(notificationSettings));
            localStorage.setItem('settings-performance', JSON.stringify(performanceSettings));

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error('Failed to save settings:', e);
        } finally {
            setLoading(false);
        }
    };

    const sections = [
        { id: 'analysis', label: 'Analysis', icon: <Sliders size={18} /> },
        { id: 'git', label: 'Git Integration', icon: <GitBranch size={18} /> },
        { id: 'performance', label: 'Performance', icon: <Cpu size={18} /> },
        { id: 'display', label: 'Display', icon: <Palette size={18} /> },
        { id: 'notifications', label: 'Notifications', icon: <AlertCircle size={18} /> },
        { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard size={18} /> },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-xl text-sky-400">
                        <Settings2 size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
                        <p className="text-sm text-slate-500">Configure analysis and display preferences</p>
                    </div>
                </div>
                <button data-testid="settings-btn-btn-1"
                    onClick={handleSave}
                    disabled={loading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        saved
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : 'bg-sky-500 hover:bg-sky-400 text-slate-900'
                    }`}
                >
                    {saved ? (
                        <>
                            <CheckCircle size={18} />
                            Saved
                        </>
                    ) : loading ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save Changes
                        </>
                    )}
                </button>
            </div>

            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-56 space-y-1">
                    {sections.map(section => (
                        <button data-testid="settings-btn-btn-2"
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors ${
                                activeSection === section.id
                                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            {section.icon}
                            <span className="text-sm font-medium">{section.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    {activeSection === 'analysis' && (
                        <div className="space-y-6">
                            <SectionHeader
                                icon={<Sliders size={20} />}
                                title="Analysis Configuration"
                                description="Choose behavior presets, tune key parameters, and refine advanced options"
                            />
                            <GitAnalysisConfigurator
                                value={analysisSettings}
                                onChange={setAnalysisSettings}
                                repoId={repo.id}
                            />
                        </div>
                    )}

                    {activeSection === 'git' && (
                        <div className="space-y-6">
                            <SectionHeader
                                icon={<GitBranch size={20} />}
                                title="Git Integration"
                                description="Configure repository links and branch settings"
                            />

                            <div className="grid grid-cols-1 gap-6">
                                <SettingField label="Repository Web URL" description="URL for viewing files in browser (GitHub, GitLab, etc.)">
                                    <input data-testid="settings-input-https://github.com/org/repo"
                                        type="url"
                                        placeholder="https://github.com/org/repo"
                                        value={gitWebUrl}
                                        onChange={(e) => setGitWebUrl(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600"
                                    />
                                </SettingField>

                                <SettingField label="Default Branch" description="Branch used for file links">
                                    <input data-testid="settings-input-main"
                                        type="text"
                                        placeholder="main"
                                        value={gitDefaultBranch}
                                        onChange={(e) => setGitDefaultBranch(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600"
                                    />
                                </SettingField>

                                {gitInfo && (
                                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                                            <Info size={14} />
                                            Detected Git Info
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <div className="text-slate-500">Remote URL</div>
                                                <div className="text-slate-300 font-mono truncate">{gitInfo.git_remote_url || 'Not detected'}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500">Provider</div>
                                                <div className="text-slate-300">{gitInfo.git_provider || 'Unknown'}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeSection === 'performance' && (
                        <div className="space-y-6">
                            <SectionHeader
                                icon={<Cpu size={20} />}
                                title="Performance Settings"
                                description="Optimize for large codebases"
                            />

                            <div className="space-y-4">
                                <ToggleSetting
                                    label="Virtual Scrolling"
                                    description="Use virtual scrolling for large file lists"
                                    checked={performanceSettings.virtualScrolling}
                                    onChange={(checked) => setPerformanceSettings(prev => ({ ...prev, virtualScrolling: checked }))}
                                />

                                <ToggleSetting
                                    label="Graph Sampling"
                                    description="Sample large graphs for better performance"
                                    checked={performanceSettings.graphSampling}
                                    onChange={(checked) => setPerformanceSettings(prev => ({ ...prev, graphSampling: checked }))}
                                />

                                <ToggleSetting
                                    label="Enable Animations"
                                    description="Show smooth transitions and animations"
                                    checked={performanceSettings.enableAnimations}
                                    onChange={(checked) => setPerformanceSettings(prev => ({ ...prev, enableAnimations: checked }))}
                                />

                                <SettingField label="Max Graph Nodes" description="Limit nodes displayed in graph view">
                                    <div className="flex items-center gap-4">
                                        <input data-testid="settings-input-input-8"
                                            type="range"
                                            min={25}
                                            max={500}
                                            step={25}
                                            value={performanceSettings.maxNodesInGraph}
                                            onChange={(e) => setPerformanceSettings(prev => ({ ...prev, maxNodesInGraph: parseInt(e.target.value) }))}
                                            className="flex-1 accent-sky-500"
                                        />
                                        <span className="w-12 text-right text-sm text-sky-400 font-semibold">
                                            {performanceSettings.maxNodesInGraph}
                                        </span>
                                    </div>
                                </SettingField>

                                <SettingField label="Lazy Load Threshold" description="Number of items before lazy loading kicks in">
                                    <div className="flex items-center gap-4">
                                        <input data-testid="settings-input-input-9"
                                            type="range"
                                            min={100}
                                            max={2000}
                                            step={100}
                                            value={performanceSettings.lazyLoadThreshold}
                                            onChange={(e) => setPerformanceSettings(prev => ({ ...prev, lazyLoadThreshold: parseInt(e.target.value) }))}
                                            className="flex-1 accent-sky-500"
                                        />
                                        <span className="w-16 text-right text-sm text-sky-400 font-semibold">
                                            {performanceSettings.lazyLoadThreshold}
                                        </span>
                                    </div>
                                </SettingField>
                            </div>
                        </div>
                    )}

                    {activeSection === 'display' && (
                        <div className="space-y-6">
                            <SectionHeader
                                icon={<Palette size={20} />}
                                title="Display Settings"
                                description="Customize appearance and behavior"
                            />

                            <SettingField label="Theme" description="Choose your preferred color scheme">
                                <div className="flex gap-2">
                                    {[
                                        { value: 'dark', icon: <Moon size={16} />, label: 'Dark' },
                                        { value: 'light', icon: <Sun size={16} />, label: 'Light' },
                                        { value: 'system', icon: <Monitor size={16} />, label: 'System' },
                                    ].map(theme => (
                                        <button data-testid="settings-btn-btn-5"
                                            key={theme.value}
                                            onClick={() => setDisplaySettings(prev => ({ ...prev, theme: theme.value as any }))}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                                                displaySettings.theme === theme.value
                                                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                                                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                                            }`}
                                        >
                                            {theme.icon}
                                            {theme.label}
                                        </button>
                                    ))}
                                </div>
                            </SettingField>

                            <SettingField label="Date Format" description="How dates are displayed">
                                <select data-testid="settings-select-select-2"
                                    value={displaySettings.dateFormat}
                                    onChange={(e) => setDisplaySettings(prev => ({ ...prev, dateFormat: e.target.value as any }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                                >
                                    <option value="relative">Relative (2 days ago)</option>
                                    <option value="absolute">Absolute (Jan 15, 2024)</option>
                                    <option value="iso">ISO (2024-01-15)</option>
                                </select>
                            </SettingField>

                            <SettingField label="Default View" description="View shown when opening a project">
                                <select data-testid="settings-select-select-3"
                                    value={displaySettings.defaultView}
                                    onChange={(e) => setDisplaySettings(prev => ({ ...prev, defaultView: e.target.value as any }))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                                >
                                    <option value="dashboard">Dashboard</option>
                                    <option value="graph">Impact Graph</option>
                                    <option value="tree">Folder Tree</option>
                                </select>
                            </SettingField>

                            <div className="space-y-4">
                                <ToggleSetting
                                    label="Compact Mode"
                                    description="Reduce padding and spacing"
                                    checked={displaySettings.compactMode}
                                    onChange={(checked) => setDisplaySettings(prev => ({ ...prev, compactMode: checked }))}
                                />

                                <ToggleSetting
                                    label="Show Line Numbers"
                                    description="Display line numbers in code views"
                                    checked={displaySettings.showLineNumbers}
                                    onChange={(checked) => setDisplaySettings(prev => ({ ...prev, showLineNumbers: checked }))}
                                />

                                <ToggleSetting
                                    label="Syntax Highlighting"
                                    description="Enable syntax highlighting in code views"
                                    checked={displaySettings.syntaxHighlighting}
                                    onChange={(checked) => setDisplaySettings(prev => ({ ...prev, syntaxHighlighting: checked }))}
                                />
                            </div>
                        </div>
                    )}

                    {activeSection === 'notifications' && (
                        <div className="space-y-6">
                            <SectionHeader
                                icon={<AlertCircle size={20} />}
                                title="Notifications"
                                description="Configure alerts and notifications"
                            />

                            <div className="space-y-4">
                                <ToggleSetting
                                    label="Analysis Complete"
                                    description="Notify when analysis finishes"
                                    checked={notificationSettings.analysisComplete}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, analysisComplete: checked }))}
                                />

                                <ToggleSetting
                                    label="Hotspot Alerts"
                                    description="Alert when new hotspots are detected"
                                    checked={notificationSettings.hotspotAlerts}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, hotspotAlerts: checked }))}
                                />

                                <ToggleSetting
                                    label="Coupling Threshold Alerts"
                                    description="Alert when coupling exceeds threshold"
                                    checked={notificationSettings.couplingThresholdAlerts}
                                    onChange={(checked) => setNotificationSettings(prev => ({ ...prev, couplingThresholdAlerts: checked }))}
                                />

                                {notificationSettings.couplingThresholdAlerts && (
                                    <SettingField label="Coupling Alert Threshold" description="Alert when coupling exceeds this percentage">
                                        <div className="flex items-center gap-4">
                                            <input data-testid="settings-input-input-10"
                                                type="range"
                                                min={50}
                                                max={90}
                                                step={5}
                                                value={notificationSettings.couplingAlertThreshold}
                                                onChange={(e) => setNotificationSettings(prev => ({ ...prev, couplingAlertThreshold: parseInt(e.target.value) }))}
                                                className="flex-1 accent-amber-500"
                                            />
                                            <span className="w-12 text-right text-sm text-amber-400 font-semibold">
                                                {notificationSettings.couplingAlertThreshold}%
                                            </span>
                                        </div>
                                    </SettingField>
                                )}
                            </div>
                        </div>
                    )}

                    {activeSection === 'shortcuts' && (
                        <div className="space-y-6">
                            <SectionHeader
                                icon={<Keyboard size={20} />}
                                title="Keyboard Shortcuts"
                                description="Quick navigation and actions"
                            />

                            <div className="space-y-2">
                                <ShortcutRow keys={['/', '⌘K']} description="Open search" />
                                <ShortcutRow keys={['G', 'D']} description="Go to Dashboard" />
                                <ShortcutRow keys={['G', 'G']} description="Go to Graph" />
                                <ShortcutRow keys={['G', 'T']} description="Go to Tree" />
                                <ShortcutRow keys={['G', 'C']} description="Go to Clustering" />
                                <ShortcutRow keys={['G', 'H']} description="Go to Hotspots" />
                                <ShortcutRow keys={['G', 'M']} description="Go to Time Machine" />
                                <ShortcutRow keys={['G', 'S']} description="Go to Settings" />
                                <ShortcutRow keys={['F']} description="Toggle filters panel" />
                                <ShortcutRow keys={['?']} description="Show keyboard shortcuts" />
                                <ShortcutRow keys={['Esc']} description="Close panel / Cancel" />
                                <ShortcutRow keys={['⌘', 'C']} description="Copy selected path" />
                                <ShortcutRow keys={['⌘', 'O']} description="Open in repository" />
                                <ShortcutRow keys={['Tab']} description="Cycle through tabs" />
                                <ShortcutRow keys={['⌘', 'S']} description="Save settings" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper Components
function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
            <span className="text-sky-400">{icon}</span>
            <div>
                <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
                <p className="text-sm text-slate-500">{description}</p>
            </div>
        </div>
    );
}

function SettingField({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
            <p className="text-xs text-slate-500 mb-2">{description}</p>
            {children}
        </div>
    );
}

function ToggleSetting({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <div>
                <div className="text-sm font-medium text-slate-300">{label}</div>
                <div className="text-xs text-slate-500">{description}</div>
            </div>
            <input data-testid="settings-input-input-11"
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
            />
        </label>
    );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
    return (
        <div className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg">
            <span className="text-sm text-slate-400">{description}</span>
            <div className="flex items-center gap-1">
                {keys.map((key, i) => (
                    <span key={i}>
                        <kbd className="px-2 py-1 bg-slate-700 rounded text-xs font-mono text-slate-300 border border-slate-600">
                            {key}
                        </kbd>
                        {i < keys.length - 1 && <span className="text-slate-600 mx-0.5">+</span>}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default SettingsView;
