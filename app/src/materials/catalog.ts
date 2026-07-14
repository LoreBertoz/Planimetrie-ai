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
  | 'pietra'
  | 'cartongesso'
  | 'laccato'
  | 'serramenti';

/** Surfaces a material can be applied to. */
export type Surface =
  | 'flooring'
  | 'walls'
  | 'ceiling'
  | 'doors'
  | 'windows'
  | 'exteriorWalls';

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
    roughnessMap?: string;
  };
  /** Surfaces this material makes sense on; undefined = any surface. */
  superfici?: Surface[];
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
  cartongesso: 'Cartongesso',
  laccato: 'Laccato',
  serramenti: 'Serramenti',
};

export const MATERIALS: MaterialDef[] = [
  {
    id: 'calce-canapa',
    nome: 'Calce-canapa (hempcrete)',
    categoria: 'canapa',
    descrizione:
      'Biocomposito di canapulo e calce: muri traspiranti, isolamento naturale e comfort in ogni stagione. Il materiale simbolo della casa sana.',
    pbr: { color: '#d9d2bf', roughness: 0.95, metalness: 0 },
    superfici: ['walls', 'exteriorWalls', 'ceiling'],
    inEvidenza: true,
  },
  {
    id: 'pannello-canapa',
    nome: 'Pannello in fibra di canapa',
    categoria: 'canapa',
    descrizione:
      'Isolante in fibra vegetale ad alte prestazioni: pareti che respirano, acustica migliore, zero sostanze tossiche.',
    pbr: { color: '#cbb98f', roughness: 0.9, metalness: 0 },
    superfici: ['walls', 'ceiling'],
    inEvidenza: true,
  },
  {
    id: 'intonaco-canapa',
    nome: 'Intonaco canapa e calce',
    categoria: 'canapa',
    descrizione:
      'Finitura naturale calda e materica, regola l’umidità e valorizza la luce degli ambienti.',
    pbr: { color: '#e3dcc8', roughness: 0.92, metalness: 0 },
    superfici: ['walls', 'ceiling', 'exteriorWalls'],
    inEvidenza: true,
  },
  {
    id: 'canapa-vista',
    nome: 'Calce-canapa a vista',
    categoria: 'canapa',
    descrizione:
      'La texture viva del biocomposito lasciata a vista in facciata: dichiarazione di sostenibilità immediata.',
    pbr: { color: '#cfc5aa', roughness: 0.98, metalness: 0 },
    superfici: ['exteriorWalls', 'walls'],
    inEvidenza: true,
  },
  {
    id: 'porta-canapa',
    nome: 'Porta in biocomposito di canapa',
    categoria: 'canapa',
    descrizione:
      'Pannello porta in biocomposito canapa-resina naturale: leggero, robusto, unico sul mercato.',
    pbr: { color: '#b8a67e', roughness: 0.75, metalness: 0 },
    superfici: ['doors'],
    inEvidenza: true,
  },
  {
    id: 'legno-rovere',
    nome: 'Rovere naturale',
    categoria: 'legno',
    descrizione: 'Rovere spazzolato: calore immediato e durata generazionale.',
    pbr: { color: '#b08d5f', roughness: 0.65, metalness: 0 },
    superfici: ['flooring', 'doors', 'walls'],
  },
  {
    id: 'legno-abete',
    nome: 'Abete sbiancato',
    categoria: 'legno',
    descrizione: 'Essenza chiara nordica, ambienti luminosi e accoglienti.',
    pbr: { color: '#d7c4a3', roughness: 0.7, metalness: 0 },
    superfici: ['flooring', 'doors', 'ceiling', 'walls'],
  },
  {
    id: 'legno-perline',
    nome: 'Perline di legno',
    categoria: 'legno',
    descrizione: 'Soffitto a doghe di legno chiaro: atmosfera calda da chalet contemporaneo.',
    pbr: { color: '#c9ab7c', roughness: 0.72, metalness: 0 },
    superfici: ['ceiling', 'walls'],
  },
  {
    id: 'legno-scuro',
    nome: 'Noce scuro',
    categoria: 'legno',
    descrizione: 'Essenza scura ed elegante per ambienti contemporanei di carattere.',
    pbr: { color: '#6f5138', roughness: 0.6, metalness: 0 },
    superfici: ['flooring', 'doors', 'walls'],
  },
  {
    id: 'facciata-legno',
    nome: 'Facciata ventilata in legno',
    categoria: 'legno',
    descrizione: 'Doghe di larice a vista: involucro naturale che invecchia con eleganza.',
    pbr: { color: '#a5814f', roughness: 0.8, metalness: 0 },
    superfici: ['exteriorWalls'],
  },
  {
    id: 'sughero',
    nome: 'Sughero naturale',
    categoria: 'sughero',
    descrizione: 'Pavimento caldo al tatto, silenzioso ed elastico. 100% rinnovabile.',
    pbr: { color: '#c19a6b', roughness: 0.85, metalness: 0 },
    superfici: ['flooring', 'walls'],
  },
  {
    id: 'calce-rasata',
    nome: 'Calce rasata',
    categoria: 'calce',
    descrizione: 'Superficie minerale liscia e luminosa, antibatterica per natura.',
    pbr: { color: '#ece8dd', roughness: 0.8, metalness: 0 },
    superfici: ['walls', 'ceiling', 'exteriorWalls'],
  },
  {
    id: 'intonaco-calce-terra',
    nome: 'Intonaco calce tono terra',
    categoria: 'calce',
    descrizione: 'Facciata in calce nei toni caldi della terra: mediterranea e senza tempo.',
    pbr: { color: '#d8b98f', roughness: 0.88, metalness: 0 },
    superfici: ['exteriorWalls', 'walls'],
  },
  {
    id: 'intonaco-calce-sabbia',
    nome: 'Intonaco calce tono sabbia',
    categoria: 'calce',
    descrizione: 'Tono sabbia luminoso che riflette la luce del sud.',
    pbr: { color: '#e6d7b8', roughness: 0.88, metalness: 0 },
    superfici: ['exteriorWalls', 'walls'],
  },
  {
    id: 'terra-cruda',
    nome: 'Intonaco in terra cruda',
    categoria: 'terra',
    descrizione: 'Tonalità terrose e regolazione naturale dell’umidità: benessere abitativo autentico.',
    pbr: { color: '#c8a678', roughness: 0.95, metalness: 0 },
    superfici: ['walls', 'ceiling'],
  },
  {
    id: 'terracotta',
    nome: 'Cotto in terracotta',
    categoria: 'terra',
    descrizione: 'Pavimento in cotto: tradizione mediterranea e calore materico.',
    pbr: { color: '#b06a45', roughness: 0.85, metalness: 0 },
    superfici: ['flooring'],
  },
  {
    id: 'lino-tessuto',
    nome: 'Rivestimento in lino',
    categoria: 'lino',
    descrizione: 'Fibra tessile naturale per superfici morbide e sofisticate.',
    pbr: { color: '#d8cfb8', roughness: 0.9, metalness: 0 },
    superfici: ['walls'],
  },
  {
    id: 'pietra-chiara',
    nome: 'Pietra calcarea chiara',
    categoria: 'pietra',
    descrizione: 'Eleganza minerale senza tempo, fresca d’estate.',
    pbr: { color: '#d5d0c4', roughness: 0.75, metalness: 0.05 },
    superfici: ['flooring', 'exteriorWalls', 'walls'],
  },
  {
    id: 'pietra-vista',
    nome: 'Pietra a vista',
    categoria: 'pietra',
    descrizione: 'Facciata in pietra naturale: solidità e radicamento nel paesaggio.',
    pbr: { color: '#b5ab99', roughness: 0.92, metalness: 0 },
    superfici: ['exteriorWalls'],
  },
  {
    id: 'cemento-chiaro',
    nome: 'Cemento chiaro levigato',
    categoria: 'pietra',
    descrizione: 'Superficie continua minerale, base neutra per interni green-industrial.',
    pbr: { color: '#cfccc2', roughness: 0.55, metalness: 0.05 },
    superfici: ['flooring', 'walls', 'ceiling'],
  },
  {
    id: 'cartongesso-bianco',
    nome: 'Cartongesso rasato bianco',
    categoria: 'cartongesso',
    descrizione: 'Controsoffitto pulito e luminoso, il classico contemporaneo.',
    pbr: { color: '#f2efe7', roughness: 0.85, metalness: 0 },
    superfici: ['ceiling', 'walls'],
  },
  {
    id: 'laccato-bianco',
    nome: 'Laccato bianco',
    categoria: 'laccato',
    descrizione: 'Porta laccata bianca: pulizia formale che sta bene ovunque.',
    pbr: { color: '#f4f1ea', roughness: 0.35, metalness: 0 },
    superfici: ['doors'],
  },
  {
    id: 'laccato-sabbia',
    nome: 'Laccato sabbia',
    categoria: 'laccato',
    descrizione: 'Laccatura calda tono sabbia, coordinata con la palette naturale.',
    pbr: { color: '#ddd0b6', roughness: 0.35, metalness: 0 },
    superfici: ['doors'],
  },
  {
    id: 'telaio-legno',
    nome: 'Serramento telaio legno',
    categoria: 'serramenti',
    descrizione: 'Finestre con telaio in legno naturale: calde dentro, durevoli fuori.',
    pbr: { color: '#9a7a4f', roughness: 0.6, metalness: 0 },
    superfici: ['windows'],
  },
  {
    id: 'telaio-legno-alluminio',
    nome: 'Serramento legno-alluminio',
    categoria: 'serramenti',
    descrizione: 'Legno all’interno, alluminio all’esterno: zero manutenzione, massima resa.',
    pbr: { color: '#8a8d8f', roughness: 0.45, metalness: 0.4 },
    superfici: ['windows'],
  },
];

export function getMaterial(id: string | undefined): MaterialDef | undefined {
  return MATERIALS.find((m) => m.id === id);
}

/** Materials applicable to a given surface (hemp first). */
export function materialsForSurface(surface: Surface): MaterialDef[] {
  return MATERIALS.filter((m) => !m.superfici || m.superfici.includes(surface)).sort(
    (a, b) => Number(b.inEvidenza ?? false) - Number(a.inEvidenza ?? false),
  );
}

/** One material per independent surface of the model. */
export interface MaterialAssignment {
  flooring: string;
  walls: string;
  ceiling: string;
  doors: string;
  windows: string;
  exteriorWalls: string;
}

export const DEFAULT_ASSIGNMENT: MaterialAssignment = {
  flooring: 'legno-rovere',
  walls: 'intonaco-canapa',
  ceiling: 'calce-rasata',
  doors: 'legno-rovere',
  windows: 'telaio-legno',
  exteriorWalls: 'calce-canapa',
};

/** Legacy (pre-Fase 7) assignment shape kept for saved-project migration. */
interface LegacyAssignment {
  esterno?: string;
  interno?: string;
  pavimento?: string;
}

/** Accepts old {esterno,interno,pavimento} or partial new shapes; returns a
 *  complete 6-surface assignment. Never throws on unknown input. */
export function migrateAssignment(raw: unknown): MaterialAssignment {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ASSIGNMENT };
  const r = raw as Partial<MaterialAssignment> & LegacyAssignment;
  const valid = (id: string | undefined, fallback: string) =>
    id && getMaterial(id) ? id : fallback;
  return {
    flooring: valid(r.flooring ?? r.pavimento, DEFAULT_ASSIGNMENT.flooring),
    walls: valid(r.walls ?? r.interno, DEFAULT_ASSIGNMENT.walls),
    ceiling: valid(r.ceiling, DEFAULT_ASSIGNMENT.ceiling),
    doors: valid(r.doors, DEFAULT_ASSIGNMENT.doors),
    windows: valid(r.windows, DEFAULT_ASSIGNMENT.windows),
    exteriorWalls: valid(r.exteriorWalls ?? r.esterno, DEFAULT_ASSIGNMENT.exteriorWalls),
  };
}
