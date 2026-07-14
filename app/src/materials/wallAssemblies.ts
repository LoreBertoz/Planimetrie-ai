// Wall assembly presets with realistic Italian thicknesses (sources in
// HANDOFF.md). Presentational credibility, not thermal calculation: the
// MaterialDef.scheda field stays the future hook for real U-value math.

import type { WallAssembly, WallLayer } from '../types';

function sum(layers: WallLayer[]): number {
  return Math.round(layers.reduce((t, l) => t + l.thickness, 0) * 1000) / 1000;
}

function assembly(
  id: string,
  nome: string,
  categoria: WallAssembly['categoria'],
  layers: WallLayer[],
): WallAssembly {
  return { id, nome, categoria, layers, thickness: sum(layers) };
}

export const WALL_ASSEMBLIES: WallAssembly[] = [
  assembly('portante-30', 'Muratura portante 30 cm', 'portante', [
    { materialId: 'calce-rasata', thickness: 0.015, function: 'intonaco' },
    { materialId: 'terracotta', thickness: 0.3, function: 'struttura' },
    { materialId: 'calce-rasata', thickness: 0.015, function: 'intonaco' },
  ]),
  assembly(
    'portante-cappotto-canapa',
    'Muratura portante 30 cm + cappotto canapa 12 cm',
    'portante',
    [
      { materialId: 'calce-rasata', thickness: 0.015, function: 'intonaco' },
      { materialId: 'terracotta', thickness: 0.3, function: 'struttura' },
      { materialId: 'pannello-canapa', thickness: 0.12, function: 'isolante' },
      { materialId: 'intonaco-canapa', thickness: 0.01, function: 'rasante' },
    ],
  ),
  assembly(
    'tamponamento-lana-roccia',
    'Tamponamento 25 cm + cappotto lana di roccia 12 cm',
    'tamponamento',
    [
      { materialId: 'calce-rasata', thickness: 0.015, function: 'intonaco' },
      { materialId: 'terra-cruda', thickness: 0.25, function: 'struttura' },
      { materialId: 'lino-tessuto', thickness: 0.12, function: 'isolante' },
      { materialId: 'calce-rasata', thickness: 0.01, function: 'rasante' },
    ],
  ),
  assembly('tramezzo-10', 'Tramezzo laterizio 10 cm', 'tramezzo', [
    { materialId: 'calce-rasata', thickness: 0.01, function: 'intonaco' },
    { materialId: 'terracotta', thickness: 0.1, function: 'struttura' },
    { materialId: 'calce-rasata', thickness: 0.01, function: 'intonaco' },
  ]),
  assembly('cartongesso-10', 'Parete cartongesso 10 cm', 'cartongesso', [
    { materialId: 'cartongesso-bianco', thickness: 0.025, function: 'cartongesso' },
    { materialId: 'pannello-canapa', thickness: 0.05, function: 'isolante' },
    { materialId: 'cartongesso-bianco', thickness: 0.025, function: 'cartongesso' },
  ]),
  assembly('facciata-ventilata-legno', 'Facciata ventilata in legno', 'facciata-ventilata', [
    { materialId: 'calce-rasata', thickness: 0.015, function: 'intonaco' },
    { materialId: 'pietra-chiara', thickness: 0.25, function: 'struttura' },
    { materialId: 'pannello-canapa', thickness: 0.1, function: 'isolante' },
    { materialId: 'canapa-vista', thickness: 0.04, function: 'intercapedine' },
    { materialId: 'facciata-legno', thickness: 0.025, function: 'rivestimento' },
  ]),
];

export const ASSEMBLY_CATEGORIA_LABEL: Record<WallAssembly['categoria'], string> = {
  portante: 'Portante',
  tamponamento: 'Tamponamento',
  tramezzo: 'Tramezzo',
  cartongesso: 'Cartongesso',
  'facciata-ventilata': 'Facciata ventilata',
};

export const LAYER_FUNCTION_LABEL: Record<WallLayer['function'], string> = {
  struttura: 'Struttura',
  isolante: 'Isolante',
  intercapedine: 'Intercapedine',
  rasante: 'Rasante',
  intonaco: 'Intonaco',
  cartongesso: 'Cartongesso',
  rivestimento: 'Rivestimento',
};

/** Default assemblies used by floorplanToWalls (hemp coat is our signature). */
export const DEFAULT_EXTERIOR_ASSEMBLY = 'portante-cappotto-canapa';
export const DEFAULT_INTERIOR_ASSEMBLY = 'tramezzo-10';

export function getAssembly(id: string | undefined): WallAssembly | undefined {
  return WALL_ASSEMBLIES.find((a) => a.id === id);
}

export function layersThickness(layers: WallLayer[]): number {
  return sum(layers);
}

/** Effective layers of a wall: custom layers win, then the preset, else none. */
export function wallLayers(wall: {
  assemblyId?: string;
  layers?: WallLayer[];
}): WallLayer[] | undefined {
  if (wall.layers && wall.layers.length > 0) return wall.layers;
  return getAssembly(wall.assemblyId)?.layers;
}
