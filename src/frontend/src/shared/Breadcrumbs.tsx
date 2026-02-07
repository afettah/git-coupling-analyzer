/**
 * Breadcrumbs Navigation
 * 
 * Shows the current navigation path and allows quick navigation.
 */

import { ChevronRight, Home } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
    label: string;
    path?: string;
    icon?: React.ReactNode;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
}

const VIEW_LABELS: Record<string, string> = {
    'graph': 'Impact Graph',
    'tree': 'Folder Tree',
    'clustering': 'Clustering',
    'dashboard': 'Dashboard',
    'hotspots': 'Hotspots',
    'time-machine': 'Time Machine',
    'settings': 'Settings',
    'file-details': 'File Details',
    'folder-details': 'Folder Details',
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    const navigate = useNavigate();

    return (
        <nav className={cn('flex items-center gap-1 text-sm', className)}>
            {items.map((item, index) => (
                <div key={index} className="flex items-center gap-1">
                    {index > 0 && (
                        <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                    )}
                    {item.path ? (
                        <button
                            onClick={() => navigate(item.path!)}
                            className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded transition-colors"
                        >
                            {item.icon}
                            <span className="truncate max-w-[150px]">{item.label}</span>
                        </button>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2 py-1 text-slate-200 font-medium">
                            {item.icon}
                            <span className="truncate max-w-[200px]">{item.label}</span>
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}

// Helper to generate breadcrumbs from current route
export function useBreadcrumbs(repoName: string, repoId: string): BreadcrumbItem[] {
    const location = useLocation();
    const path = location.pathname;

    const items: BreadcrumbItem[] = [
        { label: 'Projects', path: '/repos', icon: <Home size={14} /> },
        { label: repoName, path: `/repos/${repoId}/dashboard` },
    ];

    // Extract view from path
    const viewMatch = path.match(/\/repos\/[^/]+\/([^/]+)/);
    const view = viewMatch?.[1];

    if (view && VIEW_LABELS[view]) {
        // Check if there's a file/folder path after the view
        const subPathMatch = path.match(/\/repos\/[^/]+\/[^/]+\/(.+)/);
        
        if (subPathMatch) {
            items.push({ label: VIEW_LABELS[view], path: `/repos/${repoId}/${view}` });
            
            // Split the sub-path for file/folder details
            const subPath = decodeURIComponent(subPathMatch[1]);
            const parts = subPath.split('/');
            
            parts.forEach((part, i) => {
                const isLast = i === parts.length - 1;
                const fullPath = parts.slice(0, i + 1).join('/');
                
                if (isLast) {
                    items.push({ label: part });
                } else {
                    items.push({
                        label: part,
                        path: `/repos/${repoId}/folder-details/${encodeURIComponent(fullPath)}`,
                    });
                }
            });
        } else {
            items.push({ label: VIEW_LABELS[view] });
        }
    }

    return items;
}

export default Breadcrumbs;
