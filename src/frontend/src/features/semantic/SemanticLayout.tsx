import { useState } from 'react';
import DomainMap from './DomainMap';
import BridgeEntities from './BridgeEntities';
import { cn } from '@/lib/utils';

interface SemanticLayoutProps {
    repoId: string;
}

const tabs = [
    { id: 'domains', label: 'Domain Map' },
    { id: 'bridges', label: 'Bridge Entities' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function SemanticLayout({ repoId }: SemanticLayoutProps) {
    const [activeTab, setActiveTab] = useState<TabId>('domains');

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-1 px-4 pt-4 pb-2 border-b border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                            activeTab === tab.id
                                ? 'bg-slate-800 text-slate-100 border-b-2 border-blue-500'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-auto p-4">
                {activeTab === 'domains' && <DomainMap repoId={repoId} />}
                {activeTab === 'bridges' && <BridgeEntities repoId={repoId} />}
            </div>
        </div>
    );
}
