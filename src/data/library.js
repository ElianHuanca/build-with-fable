/**
 * Contenido de la Biblioteca SEDES (v3): 5 pestañas de tarjetas de aprendizaje.
 * Todos los textos son { es, en } (leer con tx()/txList() de src/i18n).
 *
 * Tipos de tarjeta:
 *  - 'especie'  : ficha de mosquito (viene de SPECIES): ilustración, reconocer, transmite, cría, horario, dato.
 *  - 'ciclo'    : etapa del ciclo de vida (icono 'ciclo_huevo'... 'ciclo_adulto'), duración y dónde cortar.
 *  - 'info'     : título + texto + chips (síntomas, prevención).
 *  - 'mito'     : frente "MITO" (rojo) y dorso "VERDAD" (verde): se voltea.
 *
 * Público: niños de 10 a 14 años. Contenido educativo general; verificar con SEDES / OPS.
 */
import { SPECIES } from './species.js';

const especieCard = (s) => ({
  id: `esp_${s.id}`,
  tipo: 'especie',
  icono: s.sprite,
  color: s.color,
  titulo: s.nombre,
  subtitulo: s.apodo,
  cientifico: s.cientifico,
  chips: s.reconocer,
  lineas: [
    { etiqueta: { es: 'Transmite', en: 'Transmits' }, valor: { es: s.transmite.es.join(', '), en: s.transmite.en.join(', ') } },
    { etiqueta: { es: 'Cría en', en: 'Breeds in' }, valor: s.cria },
    { etiqueta: { es: 'Pica', en: 'Bites' }, valor: s.horario },
  ],
  dato: s.dato,
});

export const LIBRARY_TABS = [
  {
    id: 'mosquitos',
    nombre: { es: 'Mosquitos', en: 'Mosquitoes' },
    icono: 'mosquito',
    tarjetas: SPECIES.map(especieCard),
  },
  {
    id: 'ciclo',
    nombre: { es: 'Ciclo de vida', en: 'Life cycle' },
    icono: 'ciclo',
    tarjetas: [
      {
        id: 'ciclo_huevo', tipo: 'ciclo', icono: 'ciclo_huevo', etapa: 1, color: '#f7c948',
        titulo: { es: '1. Huevo', en: '1. Egg' },
        subtitulo: { es: 'Dura de 2 a 3 días (o meses en seco)', en: 'Lasts 2 to 3 days (or months when dry)' },
        texto: {
          es: 'La hembra pega hasta 100 huevos en la pared de un recipiente, justo sobre el agua. Son negros y chiquitos como polvo. Aguantan meses secos y nacen apenas llueve.',
          en: 'The female sticks up to 100 eggs on the wall of a container, just above the water. They are black and tiny like dust. They survive dry for months and hatch as soon as it rains.',
        },
        corte: { es: 'Cepilla las paredes de baldes y tanques: el agua sola no los quita.', en: 'Scrub the walls of buckets and tanks: water alone does not remove them.' },
      },
      {
        id: 'ciclo_larva', tipo: 'ciclo', icono: 'ciclo_larva', etapa: 2, color: '#a8b45c',
        titulo: { es: '2. Larva', en: '2. Larva' },
        subtitulo: { es: 'Dura de 4 a 5 días', en: 'Lasts 4 to 5 days' },
        texto: {
          es: 'Parece un gusanito que nada en el agua y sube a respirar. Come lo que flota. Si ves "gusanitos" moviéndose en el agua, ¡es un criadero activo!',
          en: 'It looks like a little worm swimming in the water and coming up to breathe. It eats what floats. If you see "little worms" wiggling in the water, it is an active breeding site!',
        },
        corte: { es: 'Vacía el recipiente: sin agua, la larva muere. Es el momento más fácil de cortar el ciclo.', en: 'Empty the container: without water the larva dies. This is the easiest moment to break the cycle.' },
      },
      {
        id: 'ciclo_pupa', tipo: 'ciclo', icono: 'ciclo_pupa', etapa: 3, color: '#8a6d3b',
        titulo: { es: '3. Pupa', en: '3. Pupa' },
        subtitulo: { es: 'Dura de 1 a 2 días', en: 'Lasts 1 to 2 days' },
        texto: {
          es: 'Tiene forma de coma y no come: adentro se está transformando en mosquito. Se mueve dando saltitos cuando la molestan.',
          en: 'It is comma-shaped and does not eat: inside, it is turning into a mosquito. It tumbles around when disturbed.',
        },
        corte: { es: 'Bota el agua a la tierra o al pasto (no a un charco) y lava el recipiente.', en: 'Pour the water onto soil or grass (not into a puddle) and wash the container.' },
      },
      {
        id: 'ciclo_adulto', tipo: 'ciclo', icono: 'ciclo_adulto', etapa: 4, color: '#2c3e50',
        titulo: { es: '4. Adulto', en: '4. Adult' },
        subtitulo: { es: 'Vive de 2 a 4 semanas', en: 'Lives 2 to 4 weeks' },
        texto: {
          es: 'En total, del huevo al adulto pasan solo 7 a 10 días. Solo la hembra pica, porque necesita sangre para sus huevos. Vuela cerca de casa: unos 100 metros.',
          en: 'In total, from egg to adult takes only 7 to 10 days. Only the female bites, because it needs blood for its eggs. It flies close to home: about 100 meters.',
        },
        corte: { es: 'Repelente, mosquiteros y fumigación matan al adulto, pero el ciclo solo se corta eliminando criaderos.', en: 'Repellent, screens and fumigation kill adults, but the cycle is only broken by removing breeding sites.' },
      },
    ],
  },
  {
    id: 'sintomas',
    nombre: { es: 'Síntomas', en: 'Symptoms' },
    icono: 'sintomas',
    tarjetas: [
      {
        id: 'sin_senales', tipo: 'info', icono: 'termometro', color: '#e8703a',
        titulo: { es: '¿Cómo se siente el dengue?', en: 'What does dengue feel like?' },
        subtitulo: { es: 'Aparece de 4 a 10 días después de la picadura', en: 'Appears 4 to 10 days after the bite' },
        chips: {
          es: ['Fiebre alta de golpe', 'Dolor de cabeza', 'Dolor detrás de los ojos', 'Dolor de músculos y huesos', 'Sarpullido en la piel', 'Náuseas y mucho cansancio'],
          en: ['Sudden high fever', 'Headache', 'Pain behind the eyes', 'Muscle and bone pain', 'Skin rash', 'Nausea and strong tiredness'],
        },
        texto: {
          es: 'Si tienes fiebre y dos de estas señales, avisa a un adulto y vayan al centro de salud. No es una gripe común.',
          en: 'If you have a fever plus two of these signs, tell an adult and go to the health center. It is not a common flu.',
        },
      },
      {
        id: 'sin_alarma', tipo: 'info', icono: 'alerta', color: '#c0392b',
        titulo: { es: 'Señales de alarma', en: 'Warning signs' },
        subtitulo: { es: '¡Atención urgente, sobre todo cuando baja la fiebre!', en: 'Urgent care, especially when the fever drops!' },
        chips: {
          es: ['Dolor fuerte de barriga', 'Vómitos seguidos', 'Sangrado de nariz o encías', 'Mucho sueño o irritabilidad', 'Dificultad para respirar'],
          en: ['Strong belly pain', 'Repeated vomiting', 'Nose or gum bleeding', 'Very sleepy or irritable', 'Trouble breathing'],
        },
        texto: {
          es: 'Con cualquiera de estas señales hay que ir YA al hospital. El dengue grave se puede tratar si se atiende a tiempo.',
          en: 'With any of these signs, go to the hospital NOW. Severe dengue can be treated if caught in time.',
        },
      },
      {
        id: 'sin_hacer', tipo: 'info', icono: 'cruz', color: '#5cc23a',
        titulo: { es: '¿Qué hacer?', en: 'What to do?' },
        subtitulo: { es: 'Reposo, agua y centro de salud', en: 'Rest, water and the health center' },
        chips: {
          es: ['Tomar mucha agua y suero', 'Descansar bajo mosquitero', 'Solo paracetamol para la fiebre', 'Ir al centro de salud'],
          en: ['Drink lots of water and oral rehydration', 'Rest under a mosquito net', 'Only paracetamol for fever', 'Go to the health center'],
        },
        texto: {
          es: 'NUNCA tomes aspirina ni ibuprofeno con dengue: pueden causar sangrados. No te automediques: el médico decide.',
          en: 'NEVER take aspirin or ibuprofen with dengue: they can cause bleeding. Do not self-medicate: the doctor decides.',
        },
      },
    ],
  },
  {
    id: 'prevencion',
    nombre: { es: 'Prevención', en: 'Prevention' },
    icono: 'prevencion',
    tarjetas: [
      {
        id: 'prev_llanta', tipo: 'info', icono: 'llanta_agua', color: '#4a4f55',
        titulo: { es: 'Llantas', en: 'Tires' },
        subtitulo: { es: 'Una llanta puede criar hasta 500 mosquitos por semana', en: 'One tire can breed up to 500 mosquitoes a week' },
        chips: { es: ['Guárdala bajo techo', 'Perfórala', 'Llénala de tierra y siembra'], en: ['Store it under a roof', 'Drill holes in it', 'Fill it with soil and plant'] },
        texto: { es: 'La llanta junta agua de lluvia y calor: el hotel favorito del Aedes.', en: 'Tires collect rainwater and heat: the favorite hotel of Aedes.' },
      },
      {
        id: 'prev_tanque', tipo: 'info', icono: 'tanque_agua', color: '#4a8fb8',
        titulo: { es: 'Tanques y turriles', en: 'Tanks and drums' },
        subtitulo: { es: 'El criadero más productivo: miles de larvas en días', en: 'The most productive breeding site: thousands of larvae in days' },
        chips: { es: ['Tápalo bien', 'Malla fina', 'Cepilla las paredes cada semana'], en: ['Cover it tightly', 'Fine mesh', 'Scrub the walls every week'] },
        texto: { es: 'Si guardas agua, que sea con tapa hermética. Revisa que no queden huecos.', en: 'If you store water, use a tight lid. Check that there are no gaps.' },
      },
      {
        id: 'prev_balde', tipo: 'info', icono: 'balde_agua', color: '#e8703a',
        titulo: { es: 'Baldes, botellas y floreros', en: 'Buckets, bottles and vases' },
        subtitulo: { es: 'Dos dedos de agua alcanzan para decenas de mosquitos', en: 'Two fingers of water are enough for dozens of mosquitoes' },
        chips: { es: ['Boca abajo', 'Cambia el agua cada 3 días', 'Botella a la basura cerrada', 'Lava el platillo de las plantas'], en: ['Upside down', 'Change water every 3 days', 'Bottles in closed trash bags', 'Wash the plant saucer'] },
        texto: { es: 'Los huevos se pegan al borde: por eso hay que cepillar, no solo vaciar.', en: 'Eggs stick to the rim: that is why you must scrub, not just empty.' },
      },
      {
        id: 'prev_descacharrado', tipo: 'info', icono: 'basura', color: '#3e9a24',
        titulo: { es: 'Descacharrado', en: 'Junk clean-up' },
        subtitulo: { es: '10 minutos por semana salvan a tu barrio', en: '10 minutes a week protect your neighborhood' },
        chips: { es: ['Recorre el patio y el techo', 'Junta chatarra y latas', 'Limpia las canaletas', 'Sácalo el día del camión'], en: ['Check the yard and the roof', 'Collect scrap and cans', 'Clean the gutters', 'Put it out on garbage day'] },
        texto: { es: 'Descacharrar es sacar todo lo que junta agua. Sin criaderos, no hay dengue.', en: 'Junk clean-up means removing everything that collects water. No breeding sites, no dengue.' },
      },
      {
        id: 'prev_cuerpo', tipo: 'info', icono: 'escudo', color: '#2f6fd6',
        titulo: { es: 'Protégete tú', en: 'Protect yourself' },
        subtitulo: { es: 'Sobre todo en la mañana y al atardecer', en: 'Especially in the morning and at dusk' },
        chips: { es: ['Repelente cada 4 horas', 'Ropa clara y manga larga', 'Mosquiteros en camas y ventanas', 'Ventilador: al mosquito no le gusta el viento'], en: ['Repellent every 4 hours', 'Light-colored, long-sleeved clothes', 'Nets on beds and windows', 'A fan: mosquitoes dislike wind'] },
        texto: { es: 'Si alguien en casa tiene dengue, que duerma con mosquitero: así el mosquito no lo pica y no contagia a otros.', en: 'If someone at home has dengue, they should sleep under a net so mosquitoes cannot bite them and spread it to others.' },
      },
    ],
  },
  {
    id: 'mitos',
    nombre: { es: 'Mitos', en: 'Myths' },
    icono: 'mitos',
    tarjetas: [
      {
        id: 'mito_contagio', tipo: 'mito',
        mito: { es: 'El dengue se contagia de persona a persona, como la gripe.', en: 'Dengue spreads from person to person, like the flu.' },
        verdad: { es: 'FALSO. Solo lo transmite el mosquito Aedes al picar. Abrazar o compartir vasos con un enfermo no contagia.', en: 'FALSE. Only the Aedes mosquito transmits it when biting. Hugging or sharing cups with a sick person does not spread it.' },
      },
      {
        id: 'mito_noche', tipo: 'mito',
        mito: { es: 'El mosquito del dengue solo pica de noche.', en: 'The dengue mosquito only bites at night.' },
        verdad: { es: 'FALSO. El Aedes aegypti pica sobre todo de día: temprano en la mañana y al atardecer. El de la noche suele ser el Culex.', en: 'FALSE. Aedes aegypti bites mostly during the day: early morning and dusk. The night one is usually Culex.' },
      },
      {
        id: 'mito_inmune', tipo: 'mito',
        mito: { es: 'Si ya tuve dengue una vez, soy inmune para siempre.', en: 'If I already had dengue once, I am immune forever.' },
        verdad: { es: 'FALSO. Hay 4 tipos (serotipos) de dengue. Puedes enfermarte hasta 4 veces, y la segunda vez suele ser más grave.', en: 'FALSE. There are 4 types (serotypes) of dengue. You can get sick up to 4 times, and the second time is often worse.' },
      },
      {
        id: 'mito_sucia', tipo: 'mito',
        mito: { es: 'El mosquito del dengue cría en agua sucia.', en: 'The dengue mosquito breeds in dirty water.' },
        verdad: { es: 'FALSO. Prefiere agua LIMPIA y quieta: floreros, tanques, baldes, botellas. Por eso puede estar dentro de tu casa.', en: 'FALSE. It prefers CLEAN, still water: vases, tanks, buckets, bottles. That is why it can be inside your house.' },
      },
      {
        id: 'mito_fumigar', tipo: 'mito',
        mito: { es: 'Con fumigar el barrio ya se acaba el dengue.', en: 'Fumigating the neighborhood ends dengue.' },
        verdad: { es: 'FALSO. La fumigación mata solo a los adultos que vuelan ese día. Los huevos y larvas siguen vivos: hay que eliminar los criaderos.', en: 'FALSE. Fumigation only kills adults flying that day. Eggs and larvae stay alive: breeding sites must be removed.' },
      },
      {
        id: 'mito_aspirina', tipo: 'mito',
        mito: { es: 'Para la fiebre del dengue sirve cualquier pastilla.', en: 'Any pill works for dengue fever.' },
        verdad: { es: 'FALSO. La aspirina y el ibuprofeno pueden causar sangrado. Solo paracetamol, mucha agua y al centro de salud.', en: 'FALSE. Aspirin and ibuprofen can cause bleeding. Only paracetamol, lots of water, and go to the health center.' },
      },
    ],
  },
];

/** Todos los ids de tarjeta (para progreso e insignias). */
export const ALL_CARD_IDS = LIBRARY_TABS.flatMap((tab) => tab.tarjetas.map((c) => c.id));
/** Ids de las fichas de especie (insignia "detective"). */
export const SPECIES_CARD_IDS = SPECIES.map((s) => `esp_${s.id}`);
/** Ids por pestaña (insignia "guardián"). */
export const CARD_IDS_BY_TAB = Object.fromEntries(LIBRARY_TABS.map((tab) => [tab.id, tab.tarjetas.map((c) => c.id)]));

/** Definición de insignias (nombre y descripción para la UI; los ids los usa systems/Badges.js). */
export const INSIGNIAS = [
  { id: 'explorador', icono: 'insignia_explorador', color: '#f7c948', glifo: 'E',
    nombre: { es: 'Explorador', en: 'Explorer' }, desc: { es: 'Lee 5 tarjetas', en: 'Read 5 cards' } },
  { id: 'detective', icono: 'insignia_detective', color: '#7dd3f5', glifo: 'D',
    nombre: { es: 'Detective de larvas', en: 'Larva detective' }, desc: { es: 'Conoce las 4 especies', en: 'Meet the 4 species' } },
  { id: 'guardian', icono: 'insignia_guardian', color: '#5cc23a', glifo: 'G',
    nombre: { es: 'Guardián del barrio', en: 'Neighborhood guardian' }, desc: { es: 'Lee todas las pestañas', en: 'Read every tab' } },
  { id: 'fotografo', icono: 'insignia_fotografo', color: '#e8703a', glifo: 'F',
    nombre: { es: 'Fotógrafo', en: 'Photographer' }, desc: { es: 'Fotografía un mosquito con la cámara IA', en: 'Photograph a mosquito with the AI camera' } },
];
