// Mensajes cortos de concientización SEDES, mostrados con hud.mostrarDato() según la acción.
// Tono cercano: un compañero de SEDES dando un consejo rápido, no un cartel acusador.
//
// Bilingüe (v3): `TIPS` / `APRENDIDO` quedan en español por compatibilidad; `TIPS_EN` / `APRENDIDO_EN`
// tienen exactamente la misma estructura en inglés. Los consumidores nuevos deben usar
// `tipsL()` / `aprendidoL()` / `tipAleatorio()`, que resuelven el idioma actual (getLang()).
import { getLang } from '../i18n/index.js';

export const TIPS = {
  fumigar: [
    'La fumigación mata al mosquito adulto, pero no las larvas: hay que eliminar los criaderos.',
    'El espray actúa rápido, pero su efecto no dura para siempre: revisa la zona seguido.',
    'Fumigar es solo una parte del trabajo: sin criaderos limpios, el mosquito vuelve.',
    'Con la camioneta fumigas más rápido: útil cuando el brote ya creció.',
  ],
  estacion: [
    'Reporta los casos de fiebre alta a tu centro de salud.',
    'La estación es tu base: desde acá sale la camioneta de fumigación.',
    'Un buen agente SEDES revisa el barrio entero, no solo donde ve mosquitos.',
  ],
  brote: [
    '¡Ahí aparece un brote! Acércate y mantén presionado el botón de acción para fumigarlo antes de que crezca.',
    'Los brotes crecen con el tiempo: cuanto antes los fumigues, menos sube el riesgo de epidemia.',
  ],
  horario_manana: [
    'Es de mañana temprano: el Aedes aegypti pica más a esta hora. Revisa llantas, tanques y baldes.',
  ],
  horario_mediodia: [
    'A pleno sol, el Aedes albopictus (mosquito tigre) sigue activo: le gustan las zonas con vegetación.',
  ],
  horario_tarde: [
    'Está atardeciendo: vuelve el horario favorito del Aedes aegypti y del mosquito tigre.',
  ],
  horario_noche: [
    'De noche aparece más el Culex: no transmite dengue, pero avisa que hay agua estancada cerca.',
  ],
  horario_madrugada: [
    'De madrugada es el turno del Anopheles: se posa con el cuerpo inclinado, "de cabeza".',
  ],
};

export const TIPS_EN = {
  fumigar: [
    'Spraying kills adult mosquitoes, but not the larvae: you have to remove the breeding sites.',
    'The spray works fast, but its effect does not last forever: check the area often.',
    'Spraying is only part of the job: without clean breeding sites, the mosquito comes back.',
    'With the truck you spray faster: useful when the outbreak has already grown.',
  ],
  estacion: [
    'Report cases of high fever to your health center.',
    'The station is your base: the fumigation truck leaves from here.',
    'A good SEDES agent checks the whole neighborhood, not just where the mosquitoes are visible.',
  ],
  brote: [
    'An outbreak is starting there! Get close and hold the action button to spray it before it grows.',
    'Outbreaks grow over time: the sooner you spray them, the less the epidemic risk rises.',
  ],
  horario_manana: [
    "It's early morning: Aedes aegypti bites more at this hour. Check tires, tanks and buckets.",
  ],
  horario_mediodia: [
    'Under the midday sun, the Asian tiger mosquito (Aedes albopictus) is still active: it likes vegetated areas.',
  ],
  horario_tarde: [
    "It's dusk: the favorite hour of Aedes aegypti and the tiger mosquito is back.",
  ],
  horario_noche: [
    'At night, Culex shows up more: it does not transmit dengue, but it signals stagnant water nearby.',
  ],
  horario_madrugada: [
    "It's Anopheles' turn at dawn: it rests with its body tilted, \"head down\".",
  ],
};

// Resumen "Lo que aprendiste hoy": frases cortas para el cierre de jornada.
export const APRENDIDO = [
  'El mosquito Aedes aegypti se cría en agua limpia y quieta: llantas, tanques, baldes, botellas y floreros.',
  'Fumigar mata al mosquito adulto, pero no a las larvas: eliminar los criaderos es lo más importante.',
  'El descacharrado (limpiar y sacar los recipientes) es la mejor defensa contra el dengue.',
  'Un brote atendido a tiempo no se convierte en epidemia.',
  'Si alguien tiene fiebre alta, dolor de cabeza y dolor detrás de los ojos, hay que ir al centro de salud.',
];

export const APRENDIDO_EN = [
  'The Aedes aegypti mosquito breeds in clean, still water: tires, tanks, buckets, bottles and vases.',
  'Spraying kills adult mosquitoes, but not the larvae: removing breeding sites is what matters most.',
  'The clean-up of containers (emptying and removing them) is the best defense against dengue.',
  'An outbreak handled in time does not become an epidemic.',
  'If someone has a high fever, headache and pain behind the eyes, they should go to the health center.',
];

/** Objeto TIPS del idioma actual. */
export function tipsL() {
  return getLang() === 'en' ? TIPS_EN : TIPS;
}

/** Lista APRENDIDO del idioma actual. */
export function aprendidoL() {
  return getLang() === 'en' ? APRENDIDO_EN : APRENDIDO;
}

/** Tip aleatorio de la categoría ('fumigar' | 'estacion' | 'brote') en el idioma actual, o '' si no hay. */
export function tipAleatorio(categoria) {
  const lista = tipsL()[categoria];
  if (!Array.isArray(lista) || !lista.length) return '';
  return lista[Math.floor(Math.random() * lista.length)];
}
