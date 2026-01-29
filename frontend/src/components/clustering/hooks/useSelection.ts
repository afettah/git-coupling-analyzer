/**
 * Selection Hook
 * 
 * Manages selection state for clusters or items with multi-select support.
 */

import { useCallback, useState } from 'react';

export interface UseSelectionOptions {
    maxSelections?: number;
    onSelectionChange?: (selected: string[]) => void;
}

export interface UseSelectionReturn {
    selectedIds: string[];
    isSelected: (id: string) => boolean;
    toggle: (id: string) => void;
    select: (id: string) => void;
    deselect: (id: string) => void;
    clear: () => void;
    selectAll: (ids: string[]) => void;
}

export function useSelection({
    maxSelections,
    onSelectionChange
}: UseSelectionOptions = {}): UseSelectionReturn {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const updateSelection = useCallback((newSelection: string[]) => {
        setSelectedIds(newSelection);
        onSelectionChange?.(newSelection);
    }, [onSelectionChange]);

    const isSelected = useCallback((id: string) => {
        return selectedIds.includes(id);
    }, [selectedIds]);

    const toggle = useCallback((id: string) => {
        setSelectedIds(prev => {
            let next: string[];
            if (prev.includes(id)) {
                next = prev.filter(x => x !== id);
            } else {
                next = maxSelections ? [...prev, id].slice(-maxSelections) : [...prev, id];
            }
            onSelectionChange?.(next);
            return next;
        });
    }, [maxSelections, onSelectionChange]);

    const select = useCallback((id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) return prev;
            const next = maxSelections ? [...prev, id].slice(-maxSelections) : [...prev, id];
            onSelectionChange?.(next);
            return next;
        });
    }, [maxSelections, onSelectionChange]);

    const deselect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = prev.filter(x => x !== id);
            if (next.length !== prev.length) {
                onSelectionChange?.(next);
            }
            return next;
        });
    }, [onSelectionChange]);

    const clear = useCallback(() => {
        updateSelection([]);
    }, [updateSelection]);

    const selectAll = useCallback((ids: string[]) => {
        const limited = maxSelections ? ids.slice(-maxSelections) : ids;
        updateSelection(limited);
    }, [maxSelections, updateSelection]);

    return {
        selectedIds,
        isSelected,
        toggle,
        select,
        deselect,
        clear,
        selectAll
    };
}

export default useSelection;
