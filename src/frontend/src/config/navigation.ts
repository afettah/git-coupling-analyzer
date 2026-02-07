export const NAVIGATION_TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    {
        id: 'git',
        label: 'Git',
        icon: 'GitBranch',
        subTabs: [
            { id: 'coupling', label: 'Coupling' },
            { id: 'files', label: 'Files' },
            { id: 'hotspots', label: 'Hotspots' },
            { id: 'clustering', label: 'Clustering' },
            { id: 'time-machine', label: 'Timeline' },
        ]
    },
    { id: 'deps', label: 'Dependencies', icon: 'Box' },
    { id: 'semantic', label: 'Semantic', icon: 'Brain' },
    { id: 'graph', label: 'Graph', icon: 'Share2' },
    { id: 'risk', label: 'Risk', icon: 'ShieldAlert' },
    { id: 'settings', label: 'Settings', icon: 'Settings' },
];
