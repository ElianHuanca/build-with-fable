/**
 * Misiones secuenciales del nivel:
 *   recorrer  → "Recorre el barrio" (visitar 3 zonas distintas)
 *   encontrar → "Encuentra 3 criaderos"
 *   familia   → "Ayuda a la familia" (el criadero de level.mision_familia)
 *   proteger  → "Barrio protegido 100%" (todos los criaderos limpios)
 *
 * Se activan en orden, pero los eventos cuentan aunque la misión aún no esté
 * activa: si el jugador se adelanta, la misión se completa al activarse.
 * No depende de Phaser.
 */
export const ZONAS_OBJETIVO = 3;
export const CRIADEROS_OBJETIVO = 3;

export class MissionManager {
  /**
   * @param {{ total:number, misionFamilia?: {type:string,x:number,y:number}|null }} opts
   *   total: cantidad total de criaderos del nivel; misionFamilia: level.mision_familia
   */
  constructor({ total = 0, misionFamilia = null } = {}) {
    this.total = total;
    this.misionFamilia = misionFamilia;
    this.listeners = [];
    this.reset();
  }

  reset() {
    this.zonas = new Set();
    this.criaderosLimpios = 0;
    this.familiaLimpia = false;
    this.misiones = [
      { id: 'recorrer', texto: 'Recorre el barrio', hecho: false },
      { id: 'encontrar', texto: 'Encuentra 3 criaderos', hecho: false },
      { id: 'familia', texto: 'Ayuda a la familia', hecho: false },
      { id: 'proteger', texto: 'Barrio protegido 100%', hecho: false },
    ];
    this.emit();
  }

  /** Suscribe un callback que recibe `lista()` en cada cambio. Devuelve una función para desuscribir. */
  onChange(cb) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  emit() {
    const lista = this.lista();
    for (const cb of this.listeners) cb(lista, this);
  }

  /** Índice de la misión activa (primera no hecha) o -1 si todo está completo. */
  get activaIndex() { return this.misiones.findIndex((m) => !m.hecho); }
  get activa() { return this.misiones[this.activaIndex] || null; }
  get completo() { return this.misiones.every((m) => m.hecho); }

  /** El jugador entró en una zona (nombre). */
  onZona(nombre) {
    if (!nombre || this.zonas.has(nombre)) return;
    this.zonas.add(nombre);
    this.evaluar();
  }

  /** Se limpió un criadero ({type, x, y}). */
  onCriaderoLimpio(criadero) {
    this.criaderosLimpios += 1;
    const f = this.misionFamilia;
    if (f && criadero && criadero.type === f.type && criadero.x === f.x && criadero.y === f.y) {
      this.familiaLimpia = true;
    }
    this.evaluar();
  }

  /** Condición de cada misión (independiente del orden). */
  cumplida(id) {
    switch (id) {
      case 'recorrer': return this.zonas.size >= ZONAS_OBJETIVO;
      case 'encontrar': return this.criaderosLimpios >= CRIADEROS_OBJETIVO;
      case 'familia': return this.familiaLimpia;
      case 'proteger': return this.total > 0 && this.criaderosLimpios >= this.total;
      default: return false;
    }
  }

  /** Texto de progreso de una misión ("1/3", "2/5" o ''). */
  progresoDe(id) {
    switch (id) {
      case 'recorrer': return `${Math.min(this.zonas.size, ZONAS_OBJETIVO)}/${ZONAS_OBJETIVO}`;
      case 'encontrar': return `${Math.min(this.criaderosLimpios, CRIADEROS_OBJETIVO)}/${CRIADEROS_OBJETIVO}`;
      case 'proteger': return `${Math.min(this.criaderosLimpios, this.total)}/${this.total}`;
      default: return '';
    }
  }

  /** Completa en orden todas las misiones activas cuya condición ya se cumple. */
  evaluar() {
    let cambio = false;
    for (const m of this.misiones) {
      if (m.hecho) continue;
      if (!this.cumplida(m.id)) break; // la siguiente solo se activa cuando esta se completa
      m.hecho = true;
      cambio = true;
    }
    if (cambio) this.emit();
    return cambio;
  }

  /** @returns {{id:string, texto:string, hecho:boolean, progreso:string, activa:boolean}[]} */
  lista() {
    const ai = this.activaIndex;
    return this.misiones.map((m, i) => ({
      id: m.id, texto: m.texto, hecho: m.hecho, progreso: this.progresoDe(m.id), activa: i === ai,
    }));
  }
}
