// Preguntas de opción múltiple para el resumen de fin de jornada (v2).
// Basadas en los datos de src/data/facts.js, para ser coherentes con lo que el juego ya enseña.
//
// Bilingüe (v3): `QUIZ` (es) se mantiene por compatibilidad; `QUIZ_EN` tiene los mismos `id`,
// en el mismo orden, con el mismo índice `correcta`. Usar `quizL()` o `preguntaAleatoria()`.
import { getLang } from '../i18n/index.js';

export const QUIZ = [
  {
    id: 'llanta',
    pregunta: '¿Cuántos mosquitos puede llegar a criar una sola llanta en una semana?',
    opciones: ['Unos 10', 'Cerca de 100', 'Hasta 500', 'Más de 2000'],
    correcta: 2,
    explicacion: 'Una llanta con agua estancada puede criar hasta 500 mosquitos por semana: guárdala bajo techo o perfórala.',
  },
  {
    id: 'tanque',
    pregunta: '¿Cuál es la mejor forma de evitar que un tanque de agua sea criadero de mosquitos?',
    opciones: ['Dejarlo destapado para que se ventile', 'Taparlo con una tapa hermética o malla fina', 'Llenarlo hasta el borde', 'Ponerle sal en el fondo'],
    correcta: 1,
    explicacion: 'Un tanque destapado es de los criaderos más productivos: tápalo bien y revísalo cada semana.',
  },
  {
    id: 'balde',
    pregunta: 'Los huevos que el mosquito deja en el borde de un balde vacío...',
    opciones: ['Mueren enseguida sin agua', 'Resisten meses secos y eclosionan al mojarse', 'Solo sobreviven un día', 'Necesitan agua salada'],
    correcta: 1,
    explicacion: 'Por eso no basta con vaciar el balde: hay que cepillar las paredes y guardarlo boca abajo.',
  },
  {
    id: 'botella',
    pregunta: '¿Cuánta agua de lluvia necesita una botella tirada en el patio para criar mosquitos?',
    opciones: ['Nada, con estar húmeda alcanza', 'Con dos dedos de agua ya alcanza', 'Necesita estar casi llena', 'Nunca cría mosquitos, es muy chica'],
    correcta: 1,
    explicacion: 'Una botella con apenas dos dedos de agua puede criar decenas de mosquitos: mejor guardarla boca abajo o embolsarla.',
  },
  {
    id: 'florero',
    pregunta: '¿Cada cuánto conviene cambiar el agua de un florero?',
    opciones: ['Cada 3 días', 'Una vez al mes', 'Solo cuando se ve sucia', 'Nunca, si tiene plantas vivas'],
    correcta: 0,
    explicacion: 'El huevo se hace mosquito adulto en 7 a 10 días en agua quieta: cambiar el agua cada 3 días corta el ciclo.',
  },
  {
    id: 'ciclo',
    pregunta: '¿Cuánto tarda un huevo de Aedes aegypti en convertirse en mosquito adulto?',
    opciones: ['Unas pocas horas', '7 a 10 días en agua quieta', 'Un mes completo', 'Solo depende de la temperatura del aire'],
    correcta: 1,
    explicacion: 'En agua quieta el ciclo completo dura entre 7 y 10 días: por eso no conviene dejar agua acumulada tanto tiempo.',
  },
  {
    id: 'horario',
    pregunta: '¿En qué momento del día pica principalmente el mosquito Aedes aegypti?',
    opciones: ['De noche, como otros mosquitos', 'Al amanecer y al atardecer, con luz del día', 'Solo pica bajo techo', 'Solo pica en época de lluvia'],
    correcta: 1,
    explicacion: 'A diferencia de otros mosquitos, el Aedes aegypti pica de día, sobre todo temprano y al atardecer.',
  },
  {
    id: 'fumigar',
    pregunta: 'La fumigación mata al mosquito adulto. ¿Qué falta para cortar el ciclo del dengue?',
    opciones: ['Nada más, con fumigar alcanza', 'Eliminar los criaderos donde crecen las larvas', 'Fumigar dos veces por semana', 'Cerrar las ventanas de la casa'],
    correcta: 1,
    explicacion: 'La fumigación no mata las larvas: sin eliminar los criaderos, el mosquito vuelve a aparecer.',
  },
];

export const QUIZ_EN = [
  {
    id: 'llanta',
    pregunta: 'How many mosquitoes can a single tire breed in one week?',
    opciones: ['About 10', 'Around 100', 'Up to 500', 'More than 2000'],
    correcta: 2,
    explicacion: 'A tire with standing water can breed up to 500 mosquitoes per week: keep it under a roof or drill holes in it.',
  },
  {
    id: 'tanque',
    pregunta: 'What is the best way to stop a water tank from becoming a mosquito breeding site?',
    opciones: ['Leave it uncovered so it gets air', 'Cover it with a sealed lid or fine mesh', 'Fill it to the top', 'Put salt at the bottom'],
    correcta: 1,
    explicacion: 'An uncovered tank is one of the most productive breeding sites: cover it well and check it every week.',
  },
  {
    id: 'balde',
    pregunta: 'The eggs a mosquito leaves on the rim of an empty bucket...',
    opciones: ['Die right away without water', 'Survive months dry and hatch when they get wet', 'Only survive one day', 'Need salt water'],
    correcta: 1,
    explicacion: 'That is why emptying the bucket is not enough: you have to scrub the sides and store it upside down.',
  },
  {
    id: 'botella',
    pregunta: 'How much rainwater does a bottle left in the yard need to breed mosquitoes?',
    opciones: ['None, being damp is enough', 'Just two fingers of water is enough', 'It needs to be almost full', 'It never breeds mosquitoes, it is too small'],
    correcta: 1,
    explicacion: 'A bottle with only two fingers of water can breed dozens of mosquitoes: better store it upside down or bag it.',
  },
  {
    id: 'florero',
    pregunta: 'How often should you change the water in a vase?',
    opciones: ['Every 3 days', 'Once a month', 'Only when it looks dirty', 'Never, if the plants are alive'],
    correcta: 0,
    explicacion: 'The egg becomes an adult mosquito in 7 to 10 days in still water: changing the water every 3 days breaks the cycle.',
  },
  {
    id: 'ciclo',
    pregunta: 'How long does an Aedes aegypti egg take to become an adult mosquito?',
    opciones: ['A few hours', '7 to 10 days in still water', 'A whole month', 'It only depends on the air temperature'],
    correcta: 1,
    explicacion: 'In still water the full cycle takes 7 to 10 days: that is why you should not leave water sitting that long.',
  },
  {
    id: 'horario',
    pregunta: 'At what time of day does the Aedes aegypti mosquito mainly bite?',
    opciones: ['At night, like other mosquitoes', 'At dawn and dusk, in daylight', 'It only bites indoors', 'It only bites in the rainy season'],
    correcta: 1,
    explicacion: 'Unlike other mosquitoes, Aedes aegypti bites during the day, especially early in the morning and at dusk.',
  },
  {
    id: 'fumigar',
    pregunta: 'Spraying kills the adult mosquito. What else is needed to break the dengue cycle?',
    opciones: ['Nothing else, spraying is enough', 'Remove the breeding sites where larvae grow', 'Spray twice a week', 'Close the windows of the house'],
    correcta: 1,
    explicacion: 'Spraying does not kill the larvae: without removing the breeding sites, the mosquito comes back.',
  },
];

/** Lista QUIZ del idioma actual. */
export function quizL() {
  return getLang() === 'en' ? QUIZ_EN : QUIZ;
}

/**
 * Pregunta aleatoria en el idioma actual, evitando los `id` de `excluirIds` (array o Set).
 * Si todas están excluidas, elige entre todas. Devuelve null si no hay preguntas.
 */
export function preguntaAleatoria(excluirIds = []) {
  const lista = quizL();
  if (!lista.length) return null;
  const excl = excluirIds instanceof Set ? excluirIds : new Set(excluirIds || []);
  const candidatas = lista.filter((q) => !excl.has(q.id));
  const pool = candidatas.length ? candidatas : lista;
  return pool[Math.floor(Math.random() * pool.length)];
}
