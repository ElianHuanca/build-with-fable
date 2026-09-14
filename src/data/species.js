/**
 * Catálogo de especies de mosquito (v3): biblioteca de aprendizaje y cámara IA (demo).
 * Textos en { es, en }; usar tx()/txList() de src/i18n para leerlos.
 * `sprite`: key de textura del mosquito grande (ilustración) y `spriteMini` del pequeño
 * (enjambres); los genera tools/gen-assets.mjs. `frecuencia`: peso para la demo de la cámara.
 * Contenido educativo general; verificar con la fuente oficial (SEDES / OPS) antes de uso público.
 */
export const SPECIES = [
  {
    id: 'aegypti',
    nombre: { es: 'Aedes aegypti', en: 'Aedes aegypti' },
    apodo: { es: 'El mosquito del dengue', en: 'The dengue mosquito' },
    cientifico: 'Aedes aegypti',
    color: '#2c3e50',
    sprite: 'mosq_aegypti', spriteMini: 'mosq_aegypti_mini',
    frecuencia: 0.55,
    reconocer: {
      es: ['Cuerpo negro con rayas blancas en patas y cuerpo', 'Dibujo en forma de lira (blanco) en el tórax', 'Pequeño: 4 a 7 mm', 'Vuela bajo y pica en piernas y tobillos'],
      en: ['Black body with white stripes on legs and body', 'White lyre-shaped marking on the thorax', 'Small: 4 to 7 mm', 'Flies low and bites legs and ankles'],
    },
    transmite: { es: ['Dengue', 'Zika', 'Chikungunya', 'Fiebre amarilla'], en: ['Dengue', 'Zika', 'Chikungunya', 'Yellow fever'] },
    cria: { es: 'Agua limpia y quieta en recipientes: llantas, tanques, floreros, baldes, botellas.', en: 'Clean, still water in containers: tires, tanks, vases, buckets, bottles.' },
    horario: { es: 'Mañana temprano y atardecer', en: 'Early morning and dusk' },
    dato: { es: 'Solo la hembra pica: necesita sangre para poner hasta 100 huevos.', en: 'Only the female bites: it needs blood to lay up to 100 eggs.' },
    senales: { es: ['patas con anillos blancos', 'lira blanca en el tórax', 'tamaño pequeño'], en: ['white-ringed legs', 'white lyre on thorax', 'small size'] },
  },
  {
    id: 'albopictus',
    nombre: { es: 'Aedes albopictus', en: 'Aedes albopictus' },
    apodo: { es: 'El mosquito tigre', en: 'The tiger mosquito' },
    cientifico: 'Aedes albopictus',
    color: '#1e2a36',
    sprite: 'mosq_albopictus', spriteMini: 'mosq_albopictus_mini',
    frecuencia: 0.2,
    reconocer: {
      es: ['Negro con rayas blancas muy marcadas', 'Una sola línea blanca en el centro del tórax', 'Más agresivo de día', 'Vive en zonas con vegetación'],
      en: ['Black with very marked white stripes', 'A single white line down the center of the thorax', 'More aggressive during the day', 'Lives in vegetated areas'],
    },
    transmite: { es: ['Dengue', 'Chikungunya', 'Zika'], en: ['Dengue', 'Chikungunya', 'Zika'] },
    cria: { es: 'Huecos de árboles, bambú, recipientes con hojas y agua.', en: 'Tree holes, bamboo, containers with leaves and water.' },
    horario: { es: 'Todo el día, sobre todo temprano y tarde', en: 'All day, especially early and late' },
    dato: { es: 'Sus huevos resisten meses en seco y eclosionan con la primera lluvia.', en: 'Its eggs survive months dry and hatch with the first rain.' },
    senales: { es: ['línea blanca central', 'rayas muy contrastadas', 'patas listadas'], en: ['central white line', 'high-contrast stripes', 'striped legs'] },
  },
  {
    id: 'culex',
    nombre: { es: 'Culex', en: 'Culex' },
    apodo: { es: 'El mosquito común de la noche', en: 'The common night mosquito' },
    cientifico: 'Culex quinquefasciatus',
    color: '#8a6d3b',
    sprite: 'mosq_culex', spriteMini: 'mosq_culex_mini',
    frecuencia: 0.18,
    reconocer: {
      es: ['Color marrón claro, sin rayas blancas', 'Zumbido fuerte de noche', 'Se posa paralelo a la pared', 'Más grande que el Aedes'],
      en: ['Light brown, no white stripes', 'Loud buzzing at night', 'Rests parallel to the wall', 'Larger than Aedes'],
    },
    transmite: { es: ['Virus del Nilo Occidental', 'Filariasis'], en: ['West Nile virus', 'Filariasis'] },
    cria: { es: 'Agua sucia o estancada: zanjas, alcantarillas, charcos.', en: 'Dirty or stagnant water: ditches, sewers, puddles.' },
    horario: { es: 'Noche', en: 'Night' },
    dato: { es: 'No transmite dengue, pero su presencia indica agua estancada cerca.', en: 'It does not transmit dengue, but it signals stagnant water nearby.' },
    senales: { es: ['color marrón uniforme', 'sin rayas', 'postura paralela'], en: ['uniform brown color', 'no stripes', 'parallel posture'] },
  },
  {
    id: 'anopheles',
    nombre: { es: 'Anopheles', en: 'Anopheles' },
    apodo: { es: 'El mosquito de la malaria', en: 'The malaria mosquito' },
    cientifico: 'Anopheles darlingi',
    color: '#5a4632',
    sprite: 'mosq_anopheles', spriteMini: 'mosq_anopheles_mini',
    frecuencia: 0.07,
    reconocer: {
      es: ['Se posa con el cuerpo inclinado, "de cabeza"', 'Alas con manchas claras y oscuras', 'Palpos tan largos como la trompa', 'Zonas rurales y selva'],
      en: ['Rests with the body tilted, "head down"', 'Wings with light and dark spots', 'Palps as long as the proboscis', 'Rural and jungle areas'],
    },
    transmite: { es: ['Malaria'], en: ['Malaria'] },
    cria: { es: 'Aguas naturales limpias: orillas de ríos, lagunas, arrozales.', en: 'Clean natural water: river banks, lagoons, rice fields.' },
    horario: { es: 'Anochecer y madrugada', en: 'Dusk and before dawn' },
    dato: { es: 'Su postura inclinada al posarse es la forma más fácil de distinguirlo.', en: 'Its tilted resting posture is the easiest way to tell it apart.' },
    senales: { es: ['postura inclinada', 'alas manchadas', 'palpos largos'], en: ['tilted posture', 'spotted wings', 'long palps'] },
  },
];

export const speciesById = (id) => SPECIES.find((s) => s.id === id) || SPECIES[0];

/** Especie al azar según `frecuencia` (para brotes y para la demo de la cámara). */
export function especieAleatoria(rnd = Math.random) {
  const total = SPECIES.reduce((a, s) => a + s.frecuencia, 0);
  let r = rnd() * total;
  for (const s of SPECIES) { r -= s.frecuencia; if (r <= 0) return s; }
  return SPECIES[0];
}
