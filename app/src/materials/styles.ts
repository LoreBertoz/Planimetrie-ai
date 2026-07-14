// Style presets: one click applies a coherent material to all six surfaces.
// Previews are rendered from the assignment's material colors (no images).

import type { MaterialAssignment } from './catalog';

export interface StyleDef {
  id: string;
  nome: string;
  descrizione: string;
  assignment: MaterialAssignment;
  /** Hemp-forward styles get visual prominence. */
  inEvidenza?: boolean;
}

export const STYLES: StyleDef[] = [
  {
    id: 'rustico-canapa',
    nome: 'Rustico Canapa',
    descrizione: 'Calce-canapa, legno grezzo e terra cruda: la casa naturale per eccellenza.',
    inEvidenza: true,
    assignment: {
      flooring: 'legno-rovere',
      walls: 'intonaco-canapa',
      ceiling: 'legno-perline',
      doors: 'porta-canapa',
      windows: 'telaio-legno',
      exteriorWalls: 'canapa-vista',
    },
  },
  {
    id: 'minimal-naturale',
    nome: 'Minimal Naturale',
    descrizione: 'Calce chiara, rovere e bianco: essenziale, luminoso, senza tempo.',
    assignment: {
      flooring: 'legno-rovere',
      walls: 'calce-rasata',
      ceiling: 'cartongesso-bianco',
      doors: 'laccato-bianco',
      windows: 'telaio-legno-alluminio',
      exteriorWalls: 'calce-rasata',
    },
  },
  {
    id: 'contemporaneo-caldo',
    nome: 'Contemporaneo Caldo',
    descrizione: 'Legno scuro, sughero e pietra chiara: eleganza materica contemporanea.',
    assignment: {
      flooring: 'legno-scuro',
      walls: 'sughero',
      ceiling: 'calce-rasata',
      doors: 'legno-scuro',
      windows: 'telaio-legno-alluminio',
      exteriorWalls: 'pietra-chiara',
    },
  },
  {
    id: 'mediterraneo',
    nome: 'Mediterraneo',
    descrizione: 'Calce, terracotta e legno chiaro: la luce del sud in ogni stanza.',
    assignment: {
      flooring: 'terracotta',
      walls: 'intonaco-calce-sabbia',
      ceiling: 'calce-rasata',
      doors: 'legno-abete',
      windows: 'telaio-legno',
      exteriorWalls: 'intonaco-calce-terra',
    },
  },
  {
    id: 'industrial-green',
    nome: 'Industrial Green',
    descrizione: 'Canapa a vista, cemento chiaro e legno: carattere industriale, cuore green.',
    inEvidenza: true,
    assignment: {
      flooring: 'cemento-chiaro',
      walls: 'canapa-vista',
      ceiling: 'cemento-chiaro',
      doors: 'legno-rovere',
      windows: 'telaio-legno-alluminio',
      exteriorWalls: 'facciata-legno',
    },
  },
];

export function getStyle(id: string): StyleDef | undefined {
  return STYLES.find((s) => s.id === id);
}
