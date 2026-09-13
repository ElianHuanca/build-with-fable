// Preguntas de opción múltiple para el resumen de fin de jornada (v2).
// Basadas en los datos de src/data/facts.js, para ser coherentes con lo que el juego ya enseña.
export const QUIZ = [
  {
    pregunta: '¿Cuántos mosquitos puede llegar a criar una sola llanta en una semana?',
    opciones: ['Unos 10', 'Cerca de 100', 'Hasta 500', 'Más de 2000'],
    correcta: 2,
    explicacion: 'Una llanta con agua estancada puede criar hasta 500 mosquitos por semana: guárdala bajo techo o perfórala.',
  },
  {
    pregunta: '¿Cuál es la mejor forma de evitar que un tanque de agua sea criadero de mosquitos?',
    opciones: ['Dejarlo destapado para que se ventile', 'Taparlo con una tapa hermética o malla fina', 'Llenarlo hasta el borde', 'Ponerle sal en el fondo'],
    correcta: 1,
    explicacion: 'Un tanque destapado es de los criaderos más productivos: tápalo bien y revísalo cada semana.',
  },
  {
    pregunta: 'Los huevos que el mosquito deja en el borde de un balde vacío...',
    opciones: ['Mueren enseguida sin agua', 'Resisten meses secos y eclosionan al mojarse', 'Solo sobreviven un día', 'Necesitan agua salada'],
    correcta: 1,
    explicacion: 'Por eso no basta con vaciar el balde: hay que cepillar las paredes y guardarlo boca abajo.',
  },
  {
    pregunta: '¿Cuánta agua de lluvia necesita una botella tirada en el patio para criar mosquitos?',
    opciones: ['Nada, con estar húmeda alcanza', 'Con dos dedos de agua ya alcanza', 'Necesita estar casi llena', 'Nunca cría mosquitos, es muy chica'],
    correcta: 1,
    explicacion: 'Una botella con apenas dos dedos de agua puede criar decenas de mosquitos: mejor guardarla boca abajo o embolsarla.',
  },
  {
    pregunta: '¿Cada cuánto conviene cambiar el agua de un florero?',
    opciones: ['Cada 3 días', 'Una vez al mes', 'Solo cuando se ve sucia', 'Nunca, si tiene plantas vivas'],
    correcta: 0,
    explicacion: 'El huevo se hace mosquito adulto en 7 a 10 días en agua quieta: cambiar el agua cada 3 días corta el ciclo.',
  },
  {
    pregunta: '¿Cuánto tarda un huevo de Aedes aegypti en convertirse en mosquito adulto?',
    opciones: ['Unas pocas horas', '7 a 10 días en agua quieta', 'Un mes completo', 'Solo depende de la temperatura del aire'],
    correcta: 1,
    explicacion: 'En agua quieta el ciclo completo dura entre 7 y 10 días: por eso no conviene dejar agua acumulada tanto tiempo.',
  },
  {
    pregunta: '¿En qué momento del día pica principalmente el mosquito Aedes aegypti?',
    opciones: ['De noche, como otros mosquitos', 'Al amanecer y al atardecer, con luz del día', 'Solo pica bajo techo', 'Solo pica en época de lluvia'],
    correcta: 1,
    explicacion: 'A diferencia de otros mosquitos, el Aedes aegypti pica de día, sobre todo temprano y al atardecer.',
  },
  {
    pregunta: 'La fumigación mata al mosquito adulto. ¿Qué falta para cortar el ciclo del dengue?',
    opciones: ['Nada más, con fumigar alcanza', 'Eliminar los criaderos donde crecen las larvas', 'Fumigar dos veces por semana', 'Cerrar las ventanas de la casa'],
    correcta: 1,
    explicacion: 'La fumigación no mata las larvas: sin eliminar los criaderos, el mosquito vuelve a aparecer.',
  },
];
