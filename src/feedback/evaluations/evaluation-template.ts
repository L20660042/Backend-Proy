export const EVALUATION_ITEMS = [
  { key: 'clarity', label: 'Claridad al explicar', min: 1, max: 5 },
  { key: 'punctuality', label: 'Puntualidad', min: 1, max: 5 },
  { key: 'respect', label: 'Trato y respeto', min: 1, max: 5 },
  { key: 'planning', label: 'Planeación/organización', min: 1, max: 5 },
  { key: 'evaluation', label: 'Criterios de evaluación', min: 1, max: 5 },
] as const;

export type EvaluationItemKey = typeof EVALUATION_ITEMS[number]['key'];
