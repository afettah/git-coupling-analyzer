import {
  BEHAVIOR_PRESETS,
  computeSmartDefaultsFromScan,
  type GitAnalysisConfig,
  type BehaviorPreset,
  type ScanSignals,
} from '../features/settings/gitAnalysisConfig';

export interface MockPresetOption extends BehaviorPreset {
  recommended: boolean;
  recommendation_reason?: string;
  changed_fields: string[];
}

export interface PresetRecommendation {
  preset_id: string;
  reasons: string[];
}

export function getPresetRecommendation(scan: ScanSignals): PresetRecommendation {
  const smart = computeSmartDefaultsFromScan(scan);
  return {
    preset_id: smart.suggested_preset_id,
    reasons: smart.reasons,
  };
}

export function getMockPresetOptions(scan: ScanSignals): MockPresetOption[] {
  const recommendation = getPresetRecommendation(scan);

  return BEHAVIOR_PRESETS.map((preset) => ({
    ...preset,
    recommended: preset.id === recommendation.preset_id,
    recommendation_reason: preset.id === recommendation.preset_id ? recommendation.reasons.join(' ') : undefined,
    changed_fields: Object.keys(preset.overrides),
  }));
}

export function applyPresetToConfig(base: GitAnalysisConfig, presetId: string): GitAnalysisConfig {
  if (presetId === 'custom') {
    return { ...base, preset_id: 'custom' };
  }

  const preset = BEHAVIOR_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    return base;
  }

  return {
    ...base,
    ...preset.overrides,
    preset_id: preset.id,
  };
}
