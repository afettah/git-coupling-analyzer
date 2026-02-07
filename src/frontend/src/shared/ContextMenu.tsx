/**
 * ContextMenu Component
 * 
 * Right-click context menu for file/folder actions.
 */

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    shortcut?: string;
    disabled?: boolean;
    divider?: boolean;
    onClick?: () => void;
}

export interface ContextMenuProps {
    open: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
    onClose: () => void;
    className?: string;
}

export function ContextMenu({
    open,
    position,
    items,
    onClose,
    className,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Handle click outside
    useEffect(() => {
        if (!open) return;

        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open, onClose]);

    // Adjust position to stay within viewport
    const adjustedPosition = useCallback(() => {
        if (!menuRef.current) return position;

        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = position.x;
        let y = position.y;

        // Keep menu within viewport horizontally
        if (x + menuRect.width > viewportWidth - 10) {
            x = viewportWidth - menuRect.width - 10;
        }

        // Keep menu within viewport vertically
        if (y + menuRect.height > viewportHeight - 10) {
            y = viewportHeight - menuRect.height - 10;
        }

        return { x: Math.max(10, x), y: Math.max(10, y) };
    }, [position]);

    if (!open) return null;

    const pos = adjustedPosition();

    return (
        <div
            ref={menuRef}
            className={cn(
                'fixed z-50 min-w-[200px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden',
                'animate-in fade-in-0 zoom-in-95 duration-100',
                className
            )}
            style={{ left: pos.x, top: pos.y }}
        >
            <div className="py-1">
                {items.map((item, index) => (
                    item.divider ? (
                        <div key={`divider-${index}`} className="h-px bg-slate-700 my-1" />
                    ) : (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (!item.disabled) {
                                    item.onClick?.();
                                    onClose();
                                }
                            }}
                            disabled={item.disabled}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
                                item.disabled
                                    ? 'text-slate-600 cursor-not-allowed'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                            )}
                        >
                            {item.icon && (
                                <span className="w-4 h-4 flex items-center justify-center text-slate-500">
                                    {item.icon}
                                </span>
                            )}
                            <span className="flex-1">{item.label}</span>
                            {item.shortcut && (
                                <span className="text-xs text-slate-600 font-mono">
                                    {item.shortcut}
                                </span>
                            )}
                        </button>
                    )
                ))}
            </div>
        </div>
    );
}

export default ContextMenu;
