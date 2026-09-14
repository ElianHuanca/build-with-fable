// Datos educativos sobre Aedes aegypti por tipo de criadero.
// Se muestran al eliminar cada criadero. Fuente: SEDES Santa Cruz.
//
// Bilingüe (v3): `FACTS` (es) se mantiene por compatibilidad; `FACTS_EN` tiene las mismas
// claves en inglés. Los consumidores nuevos deben usar `factsL()` (idioma actual).
import { getLang } from '../i18n/index.js';

export const FACTS = {
  llanta: {
    nombre: 'Llanta',
    dato: 'Una llanta puede criar hasta 500 mosquitos por semana.',
    consejo: 'Guárdala bajo techo o perfórala para que no acumule agua.',
    fuente: 'SEDES Santa Cruz',
  },
  tanque: {
    nombre: 'Tanque de agua',
    dato: 'Un tanque destapado es el criadero más productivo: miles de larvas en pocos días.',
    consejo: 'Tápalo bien con una tapa hermética o malla fina y revísalo cada semana.',
    fuente: 'SEDES Santa Cruz',
  },
  balde: {
    nombre: 'Balde',
    dato: 'El mosquito pone huevos en el borde del balde; resisten meses sin agua y eclosionan al mojarse.',
    consejo: 'Vacíalo, cepilla las paredes y guárdalo boca abajo.',
    fuente: 'SEDES Santa Cruz',
  },
  botella: {
    nombre: 'Botella',
    dato: 'Una botella con dos dedos de agua de lluvia basta para criar decenas de mosquitos.',
    consejo: 'Bótala en una bolsa de basura cerrada o guárdala boca abajo.',
    fuente: 'SEDES Santa Cruz',
  },
  florero: {
    nombre: 'Florero',
    dato: 'El huevo del Aedes aegypti se vuelve mosquito adulto en 7 a 10 días en agua quieta.',
    consejo: 'Cambia el agua cada 3 días y lava bien el florero y el platillo.',
    fuente: 'SEDES Santa Cruz',
  },
};

export const FACTS_EN = {
  llanta: {
    nombre: 'Tire',
    dato: 'One tire can breed up to 500 mosquitoes per week.',
    consejo: 'Keep it under a roof or drill holes in it so it cannot hold water.',
    fuente: 'SEDES Santa Cruz',
  },
  tanque: {
    nombre: 'Water tank',
    dato: 'An uncovered tank is the most productive breeding site: thousands of larvae in a few days.',
    consejo: 'Cover it tightly with a sealed lid or fine mesh and check it every week.',
    fuente: 'SEDES Santa Cruz',
  },
  balde: {
    nombre: 'Bucket',
    dato: 'The mosquito lays its eggs on the rim of the bucket; they survive months without water and hatch when they get wet.',
    consejo: 'Empty it, scrub the sides and store it upside down.',
    fuente: 'SEDES Santa Cruz',
  },
  botella: {
    nombre: 'Bottle',
    dato: 'A bottle with just two fingers of rainwater is enough to breed dozens of mosquitoes.',
    consejo: 'Throw it away in a closed trash bag or store it upside down.',
    fuente: 'SEDES Santa Cruz',
  },
  florero: {
    nombre: 'Vase',
    dato: 'An Aedes aegypti egg becomes an adult mosquito in 7 to 10 days in still water.',
    consejo: 'Change the water every 3 days and wash the vase and its saucer well.',
    fuente: 'SEDES Santa Cruz',
  },
};

export const PUNTOS_POR_CRIADERO = 50;

/** Objeto FACTS del idioma actual. */
export function factsL() {
  return getLang() === 'en' ? FACTS_EN : FACTS;
}
