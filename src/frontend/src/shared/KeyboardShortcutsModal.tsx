/**
 * Keyboard Shortcuts Modal
 * 
 * Global keyboard shortcuts help modal.
 * Can be opened with '?' key anywhere in the app.
 */

import { useEffect, useCallback } from 'react';
import { X, Keyboard, Navigation, FileSearch, Settings, Activity, LayoutDashboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ShortcutCategory {
    title: string;
    icon: React.ReactNode;
    shortcuts: Array<{
        keys: string[];
        description: string;
    }>;
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
    {
        title: 'Navigation',
        icon: <Navigation size={16} />,
        shortcuts: [
            { keys: ['G', 'D'], description: 'Go to Dashboard' },
            { keys: ['G', 'G'], description: 'Go to Impact Graph' },
            { keys: ['G', 'T'], description: 'Go to Folder Tree' },
            { keys: ['G', 'C'], description: 'Go to Clustering' },
            { keys: ['G', 'H'], description: 'Go to Hotspots' },
            { keys: ['G', 'M'], description: 'Go to Time Machine' },
            { keys: ['G', 'S'], description: 'Go to Settings' },
            { keys: ['Esc'], description: 'Close panel / Go back' },
        ],
    },
    {
        title: 'Search & Filter',
        icon: <FileSearch size={16} />,
        shortcuts: [
            { keys: ['/', '⌘K'], description: 'Open global search' },
            { keys: ['F'], description: 'Toggle filters panel' },
            { keys: ['⌘', 'F'], description: 'Find in current view' },
            { keys: ['↑', '↓'], description: 'Navigate search results' },
            { keys: ['Enter'], description: 'Select search result' },
        ],
    },
    {
        title: 'File Actions',
        icon: <Activity size={16} />,
        shortcuts: [
            { keys: ['Enter'], description: 'Open file details' },
            { keys: ['⌘', 'C'], description: 'Copy file path' },
            { keys: ['⌘', 'O'], description: 'Open in repository' },
            { keys: ['⌘', 'B'], description: 'View git blame' },
            { keys: ['Space'], description: 'Quick preview' },
        ],
    },
    {
        title: 'Views & Panels',
        icon: <LayoutDashboard size={16} />,
        shortcuts: [
            { keys: ['Tab'], description: 'Cycle through tabs' },
            { keys: ['Shift', 'Tab'], description: 'Cycle tabs (reverse)' },
            { keys: ['1-9'], description: 'Switch to tab N' },
            { keys: ['['], description: 'Collapse sidebar' },
            { keys: [']'], description: 'Expand sidebar' },
        ],
    },
    {
        title: 'General',
        icon: <Settings size={16} />,
        shortcuts: [
            { keys: ['?'], description: 'Show keyboard shortcuts' },
            { keys: ['⌘', 'S'], description: 'Save current state' },
            { keys: ['⌘', 'E'], description: 'Export report' },
            { keys: ['R'], description: 'Refresh data' },
            { keys: ['⌘', 'Z'], description: 'Undo last action' },
        ],
    },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                            <Keyboard size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">Keyboard Shortcuts</h2>
                            <p className="text-xs text-slate-500">Navigate faster with keyboard</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[calc(85vh-80px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {SHORTCUT_CATEGORIES.map((category) => (
                            <div key={category.title} className="space-y-3">
                                <div className="flex items-center gap-2 text-sky-400">
                                    {category.icon}
                                    <h3 className="font-semibold text-sm">{category.title}</h3>
                                </div>
                                <div className="space-y-1.5">
                                    {category.shortcuts.map((shortcut, i) => (
                                        <ShortcutRow
                                            key={i}
                                            keys={shortcut.keys}
                                            description={shortcut.description}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tips */}
                    <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2">💡 Pro Tips</h4>
                        <ul className="text-xs text-slate-400 space-y-1">
                            <li>• Hold <kbd className="px-1 bg-slate-700 rounded text-slate-300">⌘</kbd> (Mac) or <kbd className="px-1 bg-slate-700 rounded text-slate-300">Ctrl</kbd> (Windows) for modifier shortcuts</li>
                            <li>• Type <kbd className="px-1 bg-slate-700 rounded text-slate-300">G</kbd> followed by a letter to quickly navigate</li>
                            <li>• Press <kbd className="px-1 bg-slate-700 rounded text-slate-300">?</kbd> anywhere to show this help</li>
                            <li>• Most shortcuts work without focusing on any specific element</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
    return (
        <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-800/50 transition-colors">
            <span className="text-xs text-slate-400">{description}</span>
            <div className="flex items-center gap-0.5">
                {keys.map((key, i) => (
                    <span key={i} className="flex items-center">
                        <kbd className="min-w-[24px] px-1.5 py-0.5 bg-slate-700 rounded text-[10px] font-mono text-slate-300 border border-slate-600 text-center">
                            {key}
                        </kbd>
                        {i < keys.length - 1 && <span className="text-slate-600 text-[10px] mx-0.5">+</span>}
                    </span>
                ))}
            </div>
        </div>
    );
}

// Hook for global keyboard shortcuts
export function useGlobalKeyboardShortcuts(callbacks: {
    onNavigate?: (path: string) => void;
    onToggleFilters?: () => void;
    onToggleShortcuts?: () => void;
    onSearch?: () => void;
    onRefresh?: () => void;
}) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Skip if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        // ? - Show shortcuts
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            callbacks.onToggleShortcuts?.();
            return;
        }

        // / or Cmd+K - Search
        if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
            e.preventDefault();
            callbacks.onSearch?.();
            return;
        }

        // F - Toggle filters
        if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            callbacks.onToggleFilters?.();
            return;
        }

        // R - Refresh
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            callbacks.onRefresh?.();
            return;
        }

        // G + letter - Navigation
        if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
            // Wait for next key
            const handleNextKey = (e2: KeyboardEvent) => {
                document.removeEventListener('keydown', handleNextKey);
                
                const routes: Record<string, string> = {
                    'd': 'dashboard',
                    'g': 'graph',
                    't': 'tree',
                    'c': 'clustering',
                    'h': 'hotspots',
                    'm': 'time-machine',
                    's': 'settings',
                };

                const path = routes[e2.key.toLowerCase()];
                if (path) {
                    e2.preventDefault();
                    callbacks.onNavigate?.(path);
                }
            };

            document.addEventListener('keydown', handleNextKey, { once: true });
            setTimeout(() => document.removeEventListener('keydown', handleNextKey), 1000);
        }
    }, [callbacks]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

export default KeyboardShortcutsModal;
