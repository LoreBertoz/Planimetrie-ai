// Visual material library — natural materials with hemp front and center.
// PBR values feed Three.js MeshStandardMaterial; copy is sales-oriented.
// Technical datasheets (insulation, cost) are post-v1: field reserved.

export type MaterialCategory =
  | 'canapa'
  | 'legno'
  | 'sughero'
  | 'calce'
  | 'terra'
  | 'lino'
  | 'pietra';

export interface MaterialDef {
  id: string;
  nome: string;
  categoria: MaterialCategory;
  /** Short sales-oriented description shown in the picker. */
  descrizione: string;
  pbr: {
    color: string; // hex
    roughness: number;
    metalness: number;
    map?: string; // texture path under public/textures/ (optional)
    normalMap?: string;
  };
  /** Hemp materials get visual prominence in the UI. */
  inEvidenza?: boolean;
  /** Reserved for post-v1 datasheets (do not populate yet). */
  scheda?: {
    isolamento?: string;
    sostenibilita?: string;
    costo?: string;
  };
}

export const CATEGORIA_LABEL: Record<MaterialCategory, string> = {
  canapa: 'Canapa',
  legno: 'Legno',
  sughero: 'Sughero',
  calce: 'Calce',
  terra: 'Terra cruda',
  lino: 'Lino',
  pietra: 'Pietra',
};

export const MATERIALS: MaterialDef[] = [
  {
    id: 'calce-canapa',
    nome: 'Calce-canapa (hempcrete)',
    categoria: 'canapa',
    descrizione:
      'Biocomposito di canapulo e calce: muri traspiranti, isolamento naturale e comfort in ogni stagione. Il materiale simbolo della casa sana.',
    pbr: { color: '#d9d2bf', roughness: 0.95, metalness: 0 },
    inEvidenza: true,
  },
  {
    id: 'pannello-canapa',
    nome: 'Pannello in fibra di canapa',
    categoria: 'canapa',
    descrizione:
      'Isolante in fibra vegetale ad alte prestazioni: pareti che respirano, acustica migliore, zero sostanze tossiche.',
    pbr: { color: '#cbb98f', roughness: 0.9, metalness: 0 },
    inEvidenza: true,
  },
  {
    id: 'intonaco-canapa',
    nome: 'Intonaco canapa e calce',
    categoria: 'canapa',
    descrizione:
      'Finitura naturale calda e materica, regola l’umidità e valorizza la luce degli ambienti.',
    pbr: { color: '#e3dcc8', roughness: 0.92, metalness: 0 },
    inEvidenza: true,
  },
  {
    id: 'legno-rovere',
    nome: 'Rovere naturale',
    categoria: 'legno',
    descrizione: 'Pavimento in rovere spazzolato: calore immediato e durata generazionale.',
    pbr: { color: '#b08d5f', roughness: 0.65, metalness: 0 },
  },
  {
    id: 'legno-abete',
    nome: 'Abete sbiancato',
    categoria: 'legno',
    descrizione: 'Essenza chiara nordica, ambienti luminosi e accoglienti.',
    pbr: { color: '#d7c4a3', roughness: 0.7, metalness: 0 },
  },
  {
    id: 'sughero',
    nome: 'Sughero naturale',
    categoria: 'sughero',
    descrizione: 'Pavimento caldo al tatto, silenzioso ed elastico. 100% rinnovabile.',
    pbr: { color: '#c19a6b', roughness: 0.85, metalness: 0 },
  },
  {
    id: 'calce-rasata',
    nome: 'Calce rasata',
    categoria: 'calce',
    descrizione: 'Superficie minerale liscia e luminosa, antibatterica per natura.',
    pbr: { color: '#ece8dd', roughness: 0.8, metalness: 0 },
  },
  {
    id: 'terra-cruda',
    nome: 'Intonaco in terra cruda',
    categoria: 'terra',
    descrizione: 'Tonalità terrose e regolazione naturale dell’umidità: benessere abitativo autentico.',
    pbr: { color: '#c8a678', roughness: 0.95, metalness: 0 },
  },
  {
    id: 'lino-tessuto',
    nome: 'Rivestimento in lino',
    categoria: 'lino',
    descrizione: 'Fibra tessile naturale per superfici morbide e sofisticate.',
    pbr: { color: '#d8cfb8', roughness: 0.9, metalness: 0 },
  },
  {
    id: 'pietra-chiara',
    nome: 'Pietra calcarea chiara',
    categoria: 'pietra',
    descrizione: 'Eleganza minerale senza tempo, fresca d’estate.',
    pbr: { color: '#d5d0c4', roughness: 0.75, metalness: 0.05 },
  },
];

export function getMaterial(id: string | undefined): MaterialDef | undefined {
  return MATERIALS.find((m) => m.id === id);
}

/** Surfaces a material can be applied to in v1. */
export interface MaterialAssignment {
  esterno: string;
  interno: string;
  pavimento: string;
}

export const DEFAULT_ASSIGNMENT: MaterialAssignment = {
  esterno: 'calce-canapa',
  interno: 'intonaco-canapa',
  pavimento: 'legno-rovere',
};
