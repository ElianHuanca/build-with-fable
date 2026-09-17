# Despliegue del servicio de inferencia (Fase 5 → Fase 6)

Estado real, verificado en la Raspberry Pi del proyecto (2026-09-17). Complementa
`docs/PLAN_V5_MODELO_IA.md` (Fases 5-7) con los pasos concretos de despliegue e integración.

## 1. Qué ya está hecho y probado

- Modelo entrenado descargado en `ml/pi/modelos/` (`detector.onnx`, `clasificador.onnx`,
  `etiquetas.json`, `preprocesado.json`) vía `ml/pi/descargar_modelos.sh`.
- Servicio corriendo como **gunicorn** (no el servidor de dev de Flask) detrás de **systemd**:
  - Unit: `/etc/systemd/system/dengue-invaders-inferencia.service` (copia versionada en
    `ml/pi/dengue-invaders-inferencia.service`).
  - Corre como usuario `admin` (sin privilegios), no como root.
  - 2 workers, `--preload` (el modelo ONNX se carga una vez en el proceso master y los workers
    lo comparten por copy-on-write, no lo duplican).
  - Arranca solo en cada boot (`enabled`).
- Endpoints (`ml/pi/servidor.py`):
  - `GET /salud` → `{"estado": "ok"}`.
  - `POST /identify` (multipart, campo `foto`) → detecciones + especie + confianza.
  - `GET /` → página HTML mínima de prueba (subir foto o usar la cámara del celular, ve el JSON
    de respuesta). Pensada para probar desde el navegador sin curl.
- **Cada foto que llega a `/identify` se guarda en `ml/pi/subidas/`** (imagen original +
  `.json` con el resultado de esa identificación), para el flywheel de reentrenamiento
  (Fase 7 del plan). Carpeta fuera de git (`.gitignore`).
- Latencia real medida (Pi 4, imagen ~2 MB, servicio ya "caliente"): **~520-940 ms** por llamada
  a `/identify`.
- Modelo probado end-to-end con fotos reales (`~/Documentos/CapturasPI/`): detecta, clasifica
  especie o marca "incierto" según el umbral de confianza (`CLASIFICADOR_CONFIANZA_MINIMA` en
  `ml/pi/inferencia.py`), y devuelve `mosquito_detectado: false` cuando no hay nada.
- **El Pi ya está expuesto a internet vía Tailscale Funnel** (§4 hecho): URL pública estable
  **`https://raspberrypi.tail8a5244.ts.net`**, HTTPS válido (Let's Encrypt), probada desde afuera
  del Pi con `/salud` y `/identify` funcionando. `tailscaled` queda `enabled` — sobrevive a
  reinicios del Pi.

## 2. Probarlo HOY desde la misma red (celular o notebook)

El Pi y el dispositivo de prueba tienen que estar en la **misma red local** (mismo Wi-Fi). IP del
Pi: revisar con `hostname -I` en el propio Pi (puede cambiar si no tiene IP fija reservada en el
router).

- **Desde el navegador del celular:** abrir `http://<ip-del-pi>:8080/` → aparece la página de
  prueba (`GET /` en `servidor.py`) → elegir "Identificar" y usar la cámara o la galería.
- **Con curl** (para debug o CI):
  ```bash
  curl -F "foto=@mosquito.jpg" http://<ip-del-pi>:8080/identify
  ```
- **Medir latencia:**
  ```bash
  curl -s -w "%{time_total}s\n" -F "foto=@mosquito.jpg" http://<ip-del-pi>:8080/identify -o /dev/null
  ```

Esto **no** necesita CORS ni HTTPS: la página de prueba se sirve desde el propio Flask (mismo
origen que `/identify`), y curl no aplica políticas de navegador.

## 3. El problema al desplegar el juego en Vercel

Vercel sirve el juego por **HTTPS** en un dominio propio (`*.vercel.app` o uno custom). Dos cosas
del navegador se ponen en el medio apenas el juego intente llamar al Pi desde ahí:

1. **Mixed content:** una página HTTPS no puede hacer `fetch()` a `http://` — el navegador lo
   bloquea directo. El Pi necesita quedar detrás de **HTTPS**, no de su IP local por HTTP.
2. **CORS:** el dominio de Vercel y el dominio/IP del Pi son orígenes distintos. Sin cabeceras
   CORS en la respuesta del Pi, el navegador descarta la respuesta aunque el request haya llegado
   bien al servidor.
3. **Alcance de red:** la IP local del Pi (`192.168.x.x`) no es alcanzable desde fuera de esa
   red — un visitante del juego en Vercel está en internet, no en el Wi-Fi de casa.

Ninguno de los tres está resuelto todavía. Son los tres pasos pendientes antes de conectar el
juego real (Fase 6) a un Pi que "se deja encendido" para que lo use gente fuera de la red local.

## 4. Exponer el Pi a internet con HTTPS — Tailscale Funnel (✅ HECHO)

**Por qué esta opción y no otra:** no requiere comprar/tener un dominio propio, da HTTPS
automático (Let's Encrypt gestionado por Tailscale), no requiere abrir puertos en el router
(nada de *port forwarding*, que expondría el Pi directo a internet sin control), y la URL pública
es estable entre reinicios del servicio (no cambia cada vez, a diferencia de un túnel gratuito de
ngrok o de un "quick tunnel" de Cloudflare).

**Ya está hecho.** URL pública: **`https://raspberrypi.tail8a5244.ts.net`**. Pasos que se
corrieron (dejados acá para referencia / para replicar en otro dispositivo):

```bash
# 1. Instalar Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Conectar el Pi a la tailnet (abre un link para loguearse con la cuenta — quedó con smn404)
sudo tailscale up

# 3. Habilitar la función Funnel a nivel de tailnet (una sola vez, desde el link que tira el
#    paso 4 la primera vez que se corre — es un flag de cuenta, no del dispositivo)

# 4. Habilitar Funnel para el puerto del servicio, en modo persistente (--bg: sigue corriendo
#    aunque se cierre la terminal; sin --bg se cae apenas termina el proceso en primer plano)
sudo tailscale funnel --bg 8080
```

`tailscaled` quedó `enabled` a nivel systemd, así que el Funnel sobrevive a reinicios del Pi sin
tener que volver a correr el paso 4.

**Nota sobre el certificado:** la primera vez que se activa el Funnel, Tailscale pide el
certificado TLS a Let's Encrypt en el momento (no antes) — la primera llamada externa puede tardar
~1-2 minutos y devolver un error de TLS mientras tanto (`tlsv1 alert internal error` en curl). Se
resuelve solo; no hace falta reintentar el comando, solo esperar y volver a pegarle al endpoint.

Verificar con:

```bash
tailscale funnel status
curl https://raspberrypi.tail8a5244.ts.net/salud
```

Esa URL es la que el juego en Vercel va a usar como base (`VITE_INFERENCE_URL`, ver §6).

**Alternativas** (si en la próxima sesión se prefiere otra cosa):
- **Cloudflare Tunnel** (`cloudflared`): igual de válido si el proyecto ya tiene o va a tener un
  dominio propio en Cloudflare. Da más control (WAF, reglas de acceso) pero pide más setup
  (agregar el dominio a Cloudflare, crear el tunnel con nombre).
- **ngrok**: rápido para probar, pero el plan gratis cambia la URL en cada reinicio salvo que se
  pague un dominio estático — no ideal para un servicio que "se deja encendido".
- **Port forwarding + Let's Encrypt manual**: NO recomendado para este caso — expone el Pi
  directo a escaneos de internet sin ninguna capa de por medio, y hay que mantener el
  certificado a mano.

## 5. CORS (✅ HECHO, con dominio placeholder)

`servidor.py` tiene CORS habilitado **solo en `/identify`** (no `CORS(app)` a secas — `/salud` y
`/` siguen sin cabeceras CORS, no hace falta), restringido a la lista `ORIGENES_PERMITIDOS` en
`servidor.py`:

```python
ORIGENES_PERMITIDOS = [
    "https://dengue-invaders.vercel.app",
    "http://localhost:5173",  # vite dev
]
```

**`dengue-invaders.vercel.app` es un placeholder** — el juego todavía no está desplegado en
Vercel. Cuando exista el dominio real (puede no ser exactamente ese, Vercel asigna el subdominio
según el nombre del proyecto, o puede terminar siendo un dominio custom), **actualizar esa lista en
`servidor.py`** y reiniciar el servicio:

```bash
sudo systemctl restart dengue-invaders-inferencia.service
```

Verificado (LAN y vía Tailscale Funnel) que el preflight `OPTIONS /identify` devuelve
`Access-Control-Allow-Origin` cuando el `Origin` está en la lista, y no lo devuelve para
cualquier otro origen (el navegador bloquea la respuesta en ese caso).

**Protección adicional a considerar** (recomendado, no implementado todavía): el endpoint queda
público sin autenticación — cualquiera con la URL puede llamarlo. Como no hay sistema de usuarios
en el juego, una opción liviana es exigir una cabecera fija (`X-Api-Key`) que el frontend de
Vercel mande en cada request, chequeada en `servidor.py` antes de correr la inferencia. No es
seguridad fuerte (la key queda en el bundle del frontend, visible a quien inspeccione el tráfico),
pero frena el abuso casual/scraping automatizado mejor que dejarlo totalmente abierto.

## 6. Integración con el juego (Fase 6 del plan) — ✅ HECHO en `CameraScene.js`

Implementado en `src/scenes/CameraScene.js` (2026-09-17), verificado con `npm run build` y con el
dev server sirviendo el módulo sin errores. **No se pudo probar interactivamente en un navegador
real desde esta sesión** (Pi sin acceso a un Chrome controlable) — falta un smoke test manual con
un dispositivo real antes de confiar en el flujo completo end-to-end.

- `disparar()` (el disparador principal del visor) **sigue simulado siempre** — no hay captura de
  cámara en vivo en el canvas de Phaser, así que "apuntar y disparar" no tiene una foto real que
  mandar. Solo las dos alternativas de foto real usan el servicio.
- `elegirFotoReal(camara)` / `cargarFotoReal(file)`: sin cambios en cómo abren la cámara/galería;
  al cargar el archivo, si `VITE_INFERENCE_URL` está configurada llaman a `identificarReal(file)`
  (nuevo), si no siguen llamando a `disparar()` (simulación, útil para desarrollar sin Pi a mano).
- `identificarReal(file)` (nuevo): hace `POST {VITE_INFERENCE_URL}/identify` con el archivo,
  reutiliza la coreografía visual de `disparar()` (flash → fase `analisis`), y la fase de análisis
  dura lo que tarde la red (mínimo `ANALISIS_REAL_MIN_MS` = 900 ms para que no se sienta
  instantánea) en vez del tiempo fijo de la demo.
- `terminarAnalisisReal()` (nuevo): traduce la respuesta de `/identify` — si hay una detección
  `seguro: true` de una de las 4 especies del juego, arma `this.especie`/`this.confianza` igual
  que `disparar()` (con la detección de mayor `confianza_especie` si hay varias cajas); si no
  (sin detección, incierta, `otro_mosquito`/`no_es_mosquito`, o error de red), deja `this.especie`
  en `null`.
- `buildResultado()`: si `this.modoReal && !this.especie`, delega en `buildResultadoIncierto()`
  (nuevo) — tarjeta simple con el motivo (`mensajeResultadoIncierto()`) y un botón "Reintentar"
  (`reintentar()`, nuevo) que vuelve al visor sin cerrar la cámara.
- `barraSuperior()`: la etiqueta "DEMO" ahora es condicional — no se muestra cuando
  `VITE_INFERENCE_URL` está configurada. Nota: como el disparador principal sigue simulado
  siempre, en rigor la demo nunca desaparece del todo hasta que haya captura de cámara real en el
  canvas; se siguió el criterio ya acordado (ocultarla cuando hay backend real) sabiendo esa
  limitación.

### 6.1 Variable de entorno para la URL del servicio

Vite (ver `vite.config.js`) expone automáticamente cualquier variable que empiece con `VITE_` vía
`import.meta.env`. **Falta configurarla** — nada de esto tiene efecto hasta que exista:

- **En Vercel:** Project Settings → Environment Variables → `VITE_INFERENCE_URL` =
  `https://raspberrypi.tail8a5244.ts.net` (la URL del §4).
- **En desarrollo local:** un `.env.local` (no versionado, Vite lo lee solo) con la misma
  variable, apuntando a la IP de LAN del Pi o a `http://localhost:8080` si se corre el servicio en
  la propia máquina.

Sin esta variable, el juego sigue en modo demo (simulación) tal como estaba — el cambio es
enteramente opt-in por variable de entorno, no rompe nada mientras no se configure.

### 6.2 Pendiente: probar en un dispositivo real

No se probó el flujo completo (sacar/elegir foto → ver el resultado real) en un navegador de
verdad todavía. Antes de confiar en esto:
1. Configurar `VITE_INFERENCE_URL` en `.env.local` apuntando al Pi.
2. `npm run dev -- --host`, abrir desde el celular en la misma red.
3. Probar los 3 casos: foto con mosquito reconocible, foto sin mosquito, y (opcional) cortar
   la red del Pi a mitad de una identificación para ver el mensaje de error.

### 6.3 Pendiente, no resuelto por este cambio

- **Múltiples detecciones:** si `/identify` devuelve varias cajas, hoy se usa la de mayor
  `confianza_especie` y el resto se descarta silenciosamente (no se le muestra nada al jugador
  sobre ellas). Si en la práctica las fotos suelen traer varios mosquitos, esto vale la pena
  revisarlo (¿mostrar todas? ¿pedir que la foto tenga uno solo?).
- **CORS con el dominio real:** sigue con el placeholder `dengue-invaders.vercel.app` (§5) — el
  `fetch` de `identificarReal` va a fallar por CORS hasta que se actualice `ORIGENES_PERMITIDOS`
  en `servidor.py` con el dominio real de Vercel.

## 7. Operación del servicio en el Pi

```bash
# estado / logs
sudo systemctl status dengue-invaders-inferencia.service
sudo journalctl -u dengue-invaders-inferencia.service -f

# reiniciar (necesario después de tocar servidor.py, inferencia.py, o bajar modelos nuevos)
sudo systemctl restart dengue-invaders-inferencia.service

# actualizar el modelo entrenado (requiere KAGGLE_API_TOKEN o ~/.kaggle/kaggle.json)
cd ~/build-with-fable/ml/pi && bash descargar_modelos.sh
sudo systemctl restart dengue-invaders-inferencia.service
```

**Disco:** `ml/pi/subidas/` crece sin límite (cada foto queda guardada para reentrenamiento, a
propósito). Revisar espacio libre de vez en cuando (`df -h`) — no hay rotación ni límite
implementado todavía; si esto se vuelve un problema, es un paso pendiente para la Fase 7
(por ejemplo, mover subidas viejas a almacenamiento externo antes de un reentreno).

## 8. Pendientes para la próxima sesión (orden sugerido)

1. ~~Instalar y configurar Tailscale Funnel en el Pi (§4)~~ → **hecho (2026-09-17)**:
   `https://raspberrypi.tail8a5244.ts.net`, verificado con `/salud` e `/identify` desde afuera.
2. Desplegar el juego en Vercel con `VITE_INFERENCE_URL` sin usar todavía (el juego sigue en modo
   demo hasta el paso 4).
3. ~~Agregar CORS restringido al dominio de Vercel (§5)~~ → **hecho (2026-09-17)**, pero con
   `dengue-invaders.vercel.app` como **placeholder** — el juego todavía no está desplegado.
   **Apenas exista el dominio real, actualizar `ORIGENES_PERMITIDOS` en `servidor.py`** (puede no
   coincidir exactamente con el placeholder) y reiniciar el servicio. Después, probar `fetch`
   desde la consola del navegador contra el dominio de Vercel ya desplegado para confirmar.
4. ~~Implementar §6 en `CameraScene.js` (llamada real + manejo de casos) y sacar la etiqueta
   "DEMO"~~ → **hecho (2026-09-17)**, pero **sin probar en un navegador/dispositivo real todavía**
   (§6.2) — hacerlo antes de dar el flujo por confiable.
5. Cuando exista el dominio real de Vercel: actualizar `ORIGENES_PERMITIDOS` en `servidor.py` y
   `VITE_INFERENCE_URL` en Vercel, y recién ahí probar `identificarReal` end-to-end (§6.2, §6.3).
6. Evaluar la cabecera `X-Api-Key` (§5) si el endpoint empieza a recibir tráfico no deseado.
