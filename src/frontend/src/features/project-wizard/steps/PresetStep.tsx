import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import type { PresetOption } from '../types';

interface PresetStepProps {
  options: PresetOption[];
  selectedPresetId: string;
  recommendedPresetId: string | null;
  onSelect: (presetId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function PresetStep({
  options,
  selectedPresetId,
  recommendedPresetId,
  onSelect,
  onBack,
  onNext,
}: PresetStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-100">Preset Selection</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick a behavior preset or continue with custom tuning.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {options.map((preset) => {
          const selected = selectedPresetId === preset.id;
          const recommended = recommendedPresetId === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? 'border-sky-500/60 bg-sky-500/10'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-100">{preset.label}</h3>
                {recommended && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                    <Sparkles size={11} />
                    recommended
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">{preset.description}</p>
              <p className="mt-2 text-xs text-slate-500">{preset.impact}</p>
              <p className="mt-3 text-[11px] text-slate-500">
                Changes {preset.changed_fields.length} parameters
              </p>
              {preset.recommendation_reason && (
                <p className="mt-2 text-xs text-emerald-300">{preset.recommendation_reason}</p>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onSelect('custom')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            selectedPresetId === 'custom'
              ? 'border-sky-500/60 bg-sky-500/10'
              : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
          }`}
        >
          <h3 className="text-sm font-semibold text-slate-100">Custom</h3>
          <p className="mt-2 text-xs text-slate-400">
            Start from smart defaults and tune every parameter manually.
          </p>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!selectedPresetId}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Configure
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
