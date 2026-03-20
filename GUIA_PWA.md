# VozSegura PWA — Guía de instalación y despliegue

## Estructura del proyecto

```
vozsegura-pwa/
├── index.html          ← App completa P2P
├── manifest.json       ← Hace la app "instalable"
├── sw.js               ← Service Worker (offline + sync + notificaciones)
├── server.py           ← Servidor HTTPS para pruebas locales
├── generate_icons.py   ← Script que generó los íconos
└── icons/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png     ← Ícono principal Android
    ├── icon-384.png
    ├── icon-512.png     ← Ícono splash screen
    └── screenshot-mobile.png
```

---

## PRUEBA LOCAL (en tu computadora primero)

### Opción A: Python (más rápido)

```bash
# Instalar Python si no lo tienes: https://python.org
cd vozsegura-pwa
python3 server.py
```

Abre en Chrome: `https://localhost:8443`

### Opción B: Node.js con http-server

```bash
npm install -g http-server
cd vozsegura-pwa
http-server -S -C cert.pem -K key.pem -p 8443
```

### Probar en tu celular desde la computadora

1. Conecta tu celular y computadora a la misma red WiFi
2. Corre `python3 server.py` — te mostrará la IP (ej: `192.168.1.5`)
3. En tu celular abre Chrome: `https://192.168.1.5:8443`
4. Acepta el aviso de certificado (normal en desarrollo)
5. Chrome mostrará el banner "Añadir a pantalla de inicio"

---

## DESPLIEGUE EN INTERNET (para compartir con todos)

### ── OPCIÓN 1: GitHub Pages (GRATIS · Recomendada) ──────

Es la forma más simple. La app queda en una URL pública con HTTPS automático.

**Paso a paso:**

1. Crea cuenta en https://github.com (si no tienes)

2. Crea repositorio nuevo → llámalo `vozsegura`

3. Sube todos los archivos:
```bash
cd vozsegura-pwa
git init
git add .
git commit -m "VozSegura PWA v1.0"
git remote add origin https://github.com/TU_USUARIO/vozsegura.git
git push -u origin main
```

4. En GitHub → Settings → Pages → Branch: main → Save

5. Tu app queda en:
   `https://TU_USUARIO.github.io/vozsegura`

6. Comparte ese enlace por WhatsApp, Telegram, etc.

**Los usuarios instalan así:**
- Android: Chrome → abrir enlace → menú ⋮ → "Añadir a pantalla de inicio"
- iOS: Safari → botón compartir → "Añadir a pantalla de inicio"

---

### ── OPCIÓN 2: Netlify (GRATIS · Más fácil aún) ────────

Sin comandos, arrastra y suelta.

1. Ve a https://netlify.com → crea cuenta gratuita
2. Arrastra la carpeta `vozsegura-pwa/` al dashboard
3. Netlify le asigna una URL automáticamente:
   `https://vozsegura-abc123.netlify.app`
4. Puedes cambiarla a: `https://vozsegura.netlify.app`

Ventajas: HTTPS automático, CDN global, actualizaciones al arrastrar.

---

### ── OPCIÓN 3: Cloudflare Pages (GRATIS · Más rápido) ──

1. Ve a https://pages.cloudflare.com
2. Conecta con GitHub o sube archivos directo
3. URL: `https://vozsegura.pages.dev`
4. Cloudflare distribuye desde ~300 servidores globales

Ventaja especial: Cloudflare protege contra ataques DDoS y censura.

---

### ── OPCIÓN 4: VPS propio (control total) ─────────────

Para máxima resistencia a la censura. Un VPS en el extranjero es más difícil de bloquear.

Proveedores económicos: DigitalOcean, Vultr, Hetzner (~$5 USD/mes)

```bash
# En el VPS (Ubuntu)
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx -y

# Copiar archivos
sudo cp -r vozsegura-pwa/* /var/www/html/

# HTTPS gratuito con Let's Encrypt (necesitas un dominio)
sudo certbot --nginx -d vozsegura.tudominio.mx

# Nginx queda sirviendo con HTTPS automático
```

---

## DOMINIO PROPIO (opcional)

Un dominio hace la app más confiable y fácil de recordar.

Registros en México: `vozsegura.mx` cuesta ~$200 MXN/año en:
- NIC México: https://www.nic.mx
- Namecheap: https://namecheap.com

Apunta el dominio a GitHub Pages o Netlify en los ajustes DNS.

---

## CÓMO SE INSTALA EN LOS CELULARES

### Android (Chrome)
1. Abrir el enlace en Chrome
2. Esperar ~5 segundos → aparece banner inferior "Añadir VozSegura"
3. O: menú ⋮ (tres puntos) → "Añadir a pantalla de inicio"
4. La app aparece con ícono en el escritorio como app nativa

### iPhone / iPad (Safari)
1. Abrir el enlace en Safari (DEBE ser Safari, no Chrome en iOS)
2. Tocar el botón de compartir (cuadro con flecha hacia arriba)
3. Bajar y tocar "Añadir a pantalla de inicio"
4. Confirmar nombre y tocar "Añadir"

### Compartir por WhatsApp/Telegram
Simplemente envía el enlace. Cuando el destinatario lo abra, podrá instalarlo sin ir a ninguna tienda.

---

## ACTUALIZACIONES AUTOMÁTICAS

Cuando subas una versión nueva al servidor, el Service Worker detecta el cambio y notifica a los usuarios que hay actualización disponible. No necesitan desinstalar ni reinstalar.

Para forzar actualización en el sw.js, cambia la versión:
```javascript
// línea 7 del sw.js
const APP_VERSION = 'vozsegura-v1.0.1'; // ← incrementar
```

---

## FUNCIONES PWA INCLUIDAS

| Función | Descripción |
|---|---|
| ✅ Instalable | Se instala como app nativa sin tiendas |
| ✅ Offline | Funciona sin internet (caché local) |
| ✅ Background Sync | Denuncias en cola se propagan al volver la conexión |
| ✅ Push Notifications | Alertas P2P aunque la app esté cerrada |
| ✅ Pantalla de carga | Splash screen oscuro al abrir |
| ✅ Sin barra del navegador | Pantalla completa modo standalone |
| ✅ Ícono en escritorio | Con ícono propio de VozSegura |
| ✅ Accesos directos | "Denunciar" y "Ver mapa" desde el ícono largo tap |
| ✅ Compartir hacia la app | Recibe fotos/videos compartidos desde otras apps |

---

## VERIFICAR QUE LA PWA ESTÁ BIEN CONFIGURADA

En Chrome desktop:
1. Abre la app
2. F12 → Application → Manifest (debe mostrar todos los campos)
3. F12 → Application → Service Workers (debe mostrar "Activated and running")
4. F12 → Lighthouse → Generate report → PWA (debe pasar todos los checks)
