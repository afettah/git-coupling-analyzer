/**
 * Command Palette
 * 
 * Global search and command interface (⌘K or /).
 * Quick navigation, file search, and action execution.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, FileCode, Folder, LayoutDashboard, Network,
    Box, Flame, Clock, Settings, ArrowRight, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { listFiles, type FileInfo } from '../api/git';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    repoId?: string;
}

interface CommandItem {
    id: string;
    type: 'navigation' | 'file' | 'action' | 'recent';
    label: string;
    description?: string;
    icon: React.ReactNode;
    path?: string;
    action?: () => void;
    shortcut?: string[];
}

export function CommandPalette({ isOpen, onClose, repoId }: CommandPaletteProps) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Load files when opened
    useEffect(() => {
        if (isOpen && repoId) {
            const loadFiles = async () => {
                setLoading(true);
                try {
                    const data = await listFiles(repoId, {
                        current_only: true,
                        limit: 100,
                        sort_by: 'commits',
                        sort_dir: 'desc',
                    });
                    setFiles(data);
                } catch (e) {
                    console.error('Failed to load files:', e);
                }
                setLoading(false);
            };
            loadFiles();
        }
    }, [isOpen, repoId]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Navigation commands
    const navigationCommands: CommandItem[] = useMemo(() => {
        if (!repoId) return [];
        return [
            { id: 'nav-dashboard', type: 'navigation', label: 'Dashboard', description: 'Project overview', icon: <LayoutDashboard size={16} />, path: `/repos/${repoId}/dashboard`, shortcut: ['G', 'D'] },
            { id: 'nav-graph', type: 'navigation', label: 'Impact Graph', description: 'Coupling visualization', icon: <Network size={16} />, path: `/repos/${repoId}/graph`, shortcut: ['G', 'G'] },
            { id: 'nav-tree', type: 'navigation', label: 'Folder Tree', description: 'Browse files', icon: <Folder size={16} />, path: `/repos/${repoId}/tree`, shortcut: ['G', 'T'] },
            { id: 'nav-clustering', type: 'navigation', label: 'Clustering', description: 'Module analysis', icon: <Box size={16} />, path: `/repos/${repoId}/clustering`, shortcut: ['G', 'C'] },
            { id: 'nav-hotspots', type: 'navigation', label: 'Hotspots', description: 'High churn files', icon: <Flame size={16} />, path: `/repos/${repoId}/hotspots`, shortcut: ['G', 'H'] },
            { id: 'nav-timemachine', type: 'navigation', label: 'Time Machine', description: 'Historical analysis', icon: <Clock size={16} />, path: `/repos/${repoId}/time-machine`, shortcut: ['G', 'M'] },
            { id: 'nav-settings', type: 'navigation', label: 'Settings', description: 'Configuration', icon: <Settings size={16} />, path: `/repos/${repoId}/settings`, shortcut: ['G', 'S'] },
        ];
    }, [repoId]);

    // File commands
    const fileCommands: CommandItem[] = useMemo(() => {
        if (!repoId) return [];
        return files.slice(0, 20).map(file => ({
            id: `file-${file.file_id}`,
            type: 'file' as const,
            label: file.path.split('/').pop() || file.path,
            description: file.path,
            icon: <FileCode size={16} />,
            path: `/repos/${repoId}/file-details/${encodeURIComponent(file.path)}`,
        }));
    }, [repoId, files]);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        const allCommands = [...navigationCommands, ...fileCommands];
        
        if (!query.trim()) {
            return allCommands.slice(0, 10);
        }

        const lowerQuery = query.toLowerCase();
        return allCommands
            .filter(cmd => 
                cmd.label.toLowerCase().includes(lowerQuery) ||
                cmd.description?.toLowerCase().includes(lowerQuery)
            )
            .slice(0, 15);
    }, [query, navigationCommands, fileCommands]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(i => Math.max(i - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    const selected = filteredCommands[selectedIndex];
                    if (selected) {
                        if (selected.path) {
                            navigate(selected.path);
                        } else if (selected.action) {
                            selected.action();
                        }
                        onClose();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, navigate, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    const handleSelect = useCallback((cmd: CommandItem) => {
        if (cmd.path) {
            navigate(cmd.path);
        } else if (cmd.action) {
            cmd.action();
        }
        onClose();
    }, [navigate, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Palette */}
            <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                    <Search size={18} className="text-slate-500 flex-shrink-0" />
                    <input data-testid="command-palette-input-search-files,-navigate..."
                        ref={inputRef}
                        type="text"
                        placeholder="Search files, navigate..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        className="flex-1 bg-transparent text-slate-200 placeholder:text-slate-500 outline-none text-sm"
                    />
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 border border-slate-700">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-slate-500">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-500" />
                        </div>
                    ) : filteredCommands.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-sm">
                            No results found
                        </div>
                    ) : (
                        filteredCommands.map((cmd, index) => (
                            <button data-testid="command-palette-btn-btn-1"
                                key={cmd.id}
                                onClick={() => handleSelect(cmd)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                                    index === selectedIndex
                                        ? 'bg-sky-500/20 text-sky-400'
                                        : 'text-slate-300 hover:bg-slate-800'
                                )}
                            >
                                <span className={cn(
                                    'flex-shrink-0',
                                    index === selectedIndex ? 'text-sky-400' : 'text-slate-500'
                                )}>
                                    {cmd.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{cmd.label}</div>
                                    {cmd.description && (
                                        <div className="text-xs text-slate-500 truncate">{cmd.description}</div>
                                    )}
                                </div>
                                {cmd.shortcut && (
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        {cmd.shortcut.map((key, i) => (
                                            <kbd
                                                key={i}
                                                className="px-1 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 border border-slate-700"
                                            >
                                                {key}
                                            </kbd>
                                        ))}
                                    </div>
                                )}
                                {index === selectedIndex && (
                                    <ArrowRight size={14} className="text-sky-400 flex-shrink-0" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900/50 text-[10px] text-slate-500">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 bg-slate-800 rounded border border-slate-700">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 bg-slate-800 rounded border border-slate-700">↵</kbd>
                            Select
                        </span>
                    </div>
                    <div className="flex items-center gap-1 text-sky-400">
                        <Sparkles size={10} />
                        <span>Powered by LFCA</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CommandPalette;
