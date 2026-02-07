import { X, Info, ExternalLink, Network, Share2, Layers, ScatterChart, Group } from 'lucide-react';

interface AlgorithmInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ALGORITHMS = [
    {
        id: "louvain",
        name: "Louvain Community Detection",
        icon: Network,
        description: "Best for finding \"natural\" communities. It groups files that frequently change together into cohesive modules.",
        useCase: "Discovering functional features or logical modules in your codebase.",
        benefit: "Detects hierarchical structures and produces very clear, high-quality clusters.",
        link: "https://en.wikipedia.org/wiki/Louvain_method"
    },
    {
        id: "label_propagation",
        name: "Label Propagation",
        icon: Share2,
        description: "A fast algorithm where each file adopts the \"identity\" of the files it is most strongly coupled with.",
        useCase: "Quick analysis of large repositories where performance is key.",
        benefit: "Extremely fast and requires no prior knowledge of the number of clusters.",
        link: "https://en.wikipedia.org/wiki/Label_propagation_algorithm"
    },
    {
        id: "dbscan",
        name: "DBSCAN",
        icon: ScatterChart,
        description: "Groups files based on coupling density. It identifies clusters of varying shapes and sizes while marking \"noise\".",
        useCase: "Finding \"core\" groups of files that are very tightly linked and ignoring loosely related files.",
        benefit: "Handles \"noise\" (files that change randomly) very well and doesn't force files into clusters.",
        link: "https://en.wikipedia.org/wiki/DBSCAN"
    },
    {
        id: "hierarchical",
        name: "Hierarchical Clustering",
        icon: Layers,
        description: "Creates a tree-like structure of files, merging them based on how similar their change patterns are.",
        useCase: "Understanding the nested relationship between different parts of the system.",
        benefit: "Visualizes the \"closeness\" between files at multiple levels of granularity.",
        link: "https://en.wikipedia.org/wiki/Hierarchical_clustering"
    },
    {
        id: "components",
        name: "Connected Components",
        icon: Group,
        description: "The simplest method; it groups any files that share at least one commit (above the minimum weight threshold).",
        useCase: "Basic reachability analysis—finding out which files are connected in any way.",
        benefit: "Simple to understand and guarantees that files in different clusters share no common history.",
        link: "https://en.wikipedia.org/wiki/Connected_component_(graph_theory)"
    }
];

export default function AlgorithmInfoModal({ isOpen, onClose }: AlgorithmInfoModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-sky-500/20 p-2 rounded-lg">
                            <Info className="w-5 h-5 text-sky-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Clustering Algorithms Guide</h3>
                            <p className="text-sm text-slate-400">Choose the best method for your analysis</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {ALGORITHMS.map((algo) => (
                            <div key={algo.id} className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-5 hover:border-slate-700 transition-colors group">
                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 group-hover:border-sky-500/30 group-hover:bg-slate-800/50 transition-all">
                                        <algo.icon className="w-6 h-6 text-sky-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
                                                {algo.name}
                                            </h4>
                                            <a
                                                href={algo.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-500 hover:text-sky-400 transition-colors flex items-center gap-1 text-xs"
                                            >
                                                Docs <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>

                                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                                            {algo.description}
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                                                <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider">Best Use Case</span>
                                                <span className="text-slate-300">{algo.useCase}</span>
                                            </div>
                                            <div className="bg-sky-500/5 border border-sky-500/10 rounded-lg p-3">
                                                <span className="text-sky-400 font-bold block mb-1 uppercase tracking-wider">Main Benefit</span>
                                                <span className="text-slate-300">{algo.benefit}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
