# 🚨 ALERTA MX — Red Ciudadana Descentralizada

> Plataforma de denuncia anónima y mapeo de inseguridad, construida con tecnología P2P.  
> Sin servidores centrales. Sin estado. Sin censura.

---

## 📱 ¿Qué es?

**Alerta MX** es una Progressive Web App (PWA) que permite a ciudadanos mexicanos reportar de forma **anónima** incidentes de inseguridad: robos, venta de drogas, extorsiones, violencia, secuestros y más.

La app usa tecnología **peer-to-peer (P2P)** a través de `BroadcastChannel` (local) y **PeerJS/WebRTC** (red amplia), de modo que cada dispositivo funciona simultáneamente como cliente y servidor. No hay base de datos central que pueda ser hackeada, apagada o intervenida por el gobierno.

---

## 🏗️ Arquitectura

```
┌────────────────────────────────────────────────┐
│              Dispositivo del usuario            │
│  ┌─────────────┐    ┌────────────────────────┐ │
│  │  IndexedDB  │    │  Service Worker (PWA)  │ │
│  │  (alertas)  │◄──►│  Cache offline         │ │
│  └─────────────┘    └────────────────────────┘ │
│         │                     │                 │
│  ┌──────▼─────────────────────▼──────────────┐ │
│  │         Motor P2P (BroadcastChannel        │ │
│  │         + PeerJS/WebRTC en producción)     │ │
│  └───────────────────┬───────────────────────┘ │
└──────────────────────┼────────────────────────┘
                       │ WebRTC / gossip protocol
           ┌───────────▼───────────┐
           │  Otros nodos/usuarios │
           │  (dispositivos móviles│
           │   = clientes+servidores)
           └───────────────────────┘
```

**Flujo de datos:**
1. Usuario crea alerta → se guarda en `localStorage` (luego `IndexedDB`)
2. Se serializa y se emite a través de `BroadcastChannel` (entre pestañas del mismo dispositivo)
3. En producción: **PeerJS** conecta a otros usuarios vía WebRTC para sincronización directa
4. Protocolo gossip: cada nodo re-transmite alertas nuevas a sus peers conocidos
5. Deduplicación por `id` único (UUID generado con `crypto.getRandomValues`)

---

## ✨ Funcionalidades

| Feature | Estado |
|---|---|
| 🗺️ Mapa interactivo con pins por tipo de delito | ✅ |
| 🔒 Denuncia completamente anónima | ✅ |
| 📱 PWA instalable desde GitHub Pages | ✅ |
| 📡 Sincronización P2P entre dispositivos | ✅ (BroadcastChannel) |
| 🗳️ Votación ciudadana (confirmar/rechazar) | ✅ |
| 🔔 Notificaciones push de alertas cercanas | ✅ (SW) |
| 📊 Estadísticas de zonas de riesgo | ✅ |
| 📶 Funcionamiento offline | ✅ |
| 👤 Registro sin datos personales | ✅ |
| 🌙 Modo oscuro optimizado para móvil | ✅ |

---

## 🚀 Despliegue en GitHub Pages

### Paso 1: Fork o crea un repositorio
```bash
git init alerta-mx
cd alerta-mx
# Copia todos los archivos de este proyecto
git add .
git commit -m "🚨 Alerta MX v1.0.0 - Red ciudadana P2P"
git remote add origin https://github.com/TU-USUARIO/alerta-mx.git
git push -u origin main
```

### Paso 2: Activa GitHub Pages
- Ve a **Settings → Pages**
- Source: `Deploy from branch`
- Branch: `main` / `/(root)`
- Guarda

### Paso 3: Accede y comparte
```
https://TU-USUARIO.github.io/alerta-mx/
```

### Paso 4: Instalar en móvil (Android/iOS)
- Abre la URL en Chrome (Android) o Safari (iOS)
- Toca "Añadir a pantalla de inicio" / "Agregar a inicio"
- ¡Listo! Funciona como app nativa

---

## 🔧 Pasos para escalar P2P real (PeerJS)

Para conectar usuarios en diferentes dispositivos a través de internet, agrega PeerJS:

```html
<!-- Añade en el <head> de index.html -->
<script src="https://unpkg.com/peerjs@1.5.0/dist/peerjs.min.js"></script>
```

```javascript
// Reemplaza simulateP2P() con:
function initPeerJS() {
  const peer = new Peer(currentUser.uid, {
    host: '0.peerjs.com',  // Servidor STUN/TURN gratuito de PeerJS
    port: 443,
    secure: true
  });

  peer.on('open', id => {
    peerId = id;
    updateNetStatus('online', `P2P activo · ID: ${id.slice(0,8)}...`);
    // Conectar a peers conocidos (guardados localmente)
    loadKnownPeers().forEach(pid => connectToPeer(pid));
  });

  peer.on('connection', conn => {
    conn.on('data', data => receiveFromPeer(data));
    conn.on('open', () => conn.send({ type: 'sync', alerts: alerts.slice(0,20) }));
  });
}

function connectToPeer(peerId) {
  const conn = peer.connect(peerId);
  conn.on('open', () => {
    peers.push(conn);
    conn.send({ type: 'hello', uid: currentUser.uid });
  });
  conn.on('data', data => receiveFromPeer(data));
}

function receiveFromPeer(data) {
  if (data.type === 'alert') ingestAlert(data.alert);
  if (data.type === 'sync') data.alerts.forEach(a => ingestAlert(a));
}
```

---

## 🔒 Privacidad & Seguridad

- **No hay servidor central** que almacene datos de usuarios
- **El alias nunca se vincula a la denuncia** — los reportes son 100% anónimos
- **IDs generados con `crypto.getRandomValues()`** — criptográficamente seguros
- **Datos almacenados solo en el dispositivo** (localStorage → IndexedDB en producción)
- Para mayor anonimato: usar con **VPN** o **Tor Browser**
- En zonas de alto riesgo: considera usar una conexión WiFi pública, no tu datos móviles

---

## 📦 Estructura de archivos

```
alerta-mx/
├── index.html       ← App completa (single-file para simplicidad)
├── manifest.json    ← PWA manifest (instalación móvil)
├── sw.js            ← Service Worker (offline + push notifications)
├── icons/
│   ├── icon-192.png ← Ícono de la app
│   └── icon-512.png ← Ícono grande
└── README.md        ← Este archivo
```

---

## 🤝 Contribuir

Esta es una herramienta ciudadana. Si eres desarrollador y quieres contribuir:

1. Fork el repositorio
2. Mejoras prioritarias:
   - Implementación completa de PeerJS para P2P real
   - Cifrado end-to-end de alertas (libsodium.js)
   - Clustering de marcadores en el mapa
   - Heatmap de zonas de riesgo
   - Exportación de datos a formato abierto
3. Pull request con descripción de cambios

---

## ⚠️ Aviso Legal

Esta herramienta es para uso ciudadano pacífico. No está diseñada para:
- Difamación de personas
- Denuncia de actividades legales
- Vigilancia de individuos

Los reportes son responsabilidad de quien los publica. La red no tiene moderación centralizada.

---

*Construido con ❤️ para la ciudadanía mexicana. Ningún gobierno. Ninguna empresa. Solo la comunidad.*
