# 🏛️ Musée 3D - Projection Volumétrique v1.3.1

Un musée 3D immersif avec projection volumétrique sur 4 surfaces (sol + 3 murs).

## 📦 Fichiers

```
museum-volumetric.html          # Page principale du musée
MUSEUM_COMPLETE.js              # Structure 3D du musée + navigation FPS
VolumetricProtocol.js           # Protocole volumétrique v1.3.1 (exact)
MuseumProjectionManager.js      # Gestion multi-surfaces
```

## 🚀 Démarrage rapide

### Option 1 : Serveur local simple

```bash
# Python 3
python -m http.server 8000

# Node.js (avec http-server)
npx http-server -p 8000
```

Puis ouvrir : `http://localhost:8000/museum-volumetric.html`

### Option 2 : Live Server (VS Code)

1. Installer l'extension "Live Server"
2. Clic droit sur `museum-volumetric.html` → "Open with Live Server"

## 🎮 Contrôles

### Navigation
- **ZQSD** ou **WASD** ou **Flèches** : Déplacement
- **Souris** : Orientation de la caméra
- **Clic** : Activer le mode navigation
- **ESC** : Désactiver le mode navigation

### Projections
1. **Charger une vidéo/image** : Parcourir vos fichiers
2. **Choisir la surface cible** :
   - Toutes les surfaces (synchronisé)
   - Sol uniquement
   - Mur gauche uniquement
   - Mur droit uniquement
   - Mur fond uniquement
3. **Ajuster les paramètres** :
   - Forme des particules (cercle, carré, diamant, étoile)
   - Mode 3D activé/désactivé

## 🏗️ Architecture du musée

### Dimensions
- **Longueur** : 900 unités (axe Z)
- **Largeur** : 700 unités (axe X)
- **Hauteur** : 600 unités (axe Y)

### Surfaces de projection

| Surface | Position | Rotation | Dimensions |
|---------|----------|----------|------------|
| **Sol** | (0, 1, 0) | x: -90° | 560×540 |
| **Mur gauche** | (-345, 250, 0) | y: 90° | 500×720 |
| **Mur droit** | (345, 250, 0) | y: -90° | 500×720 |
| **Mur fond** | (0, 250, -445) | y: 0° | 560×500 |

## 🎬 Protocole Volumétrique v1.3.1

### Paramètres EXACTS (non modifiables)
- `TARGET_SIZE = 1000` (fixe)
- `scaleFactor = 0.5` (fixe)
- Calcul de profondeur basé sur la luminance

### Paramètres ajustables
- `pointSize`: Taille des particules (défaut: 1.0)
- `particleDensity`: Densité 1-15x (défaut: 7)
- `depthMultiplier`: Spread de profondeur (défaut: 1.0)
- `breathSpeed`: Vitesse d'animation (défaut: 1.0)
- `brightness`: Luminosité (défaut: 1.8)
- `flowIntensity`: Mouvement organique (défaut: 0.0)
- `hideBlack`: Masquer les particules noires
- `currentShape`: circle | square | diamond | star
- `is3DMode`: true (3D) | false (2D points)

## 📋 Utilisation programmatique

### Exemple basique

```javascript
import { MuseumScene } from './MUSEUM_COMPLETE.js';
import { MuseumProjectionManager } from './MuseumProjectionManager.js';

// 1. Créer le musée
const museum = new MuseumScene();
museum.init(document.getElementById('app'));

// 2. Créer le gestionnaire de projections
const manager = new MuseumProjectionManager(museum);

// 3. Charger une vidéo
const video = document.createElement('video');
video.src = 'ma-video.mp4';
await video.play();

// 4. Créer des projections synchronisées
const screens = ['SCREEN_FLOOR', 'SCREEN_WALL_LEFT', 'SCREEN_WALL_RIGHT', 'SCREEN_WALL_BACK'];
await manager.createSyncedProjections(screens, video, {
  pointSize: 1.0,
  particleDensity: 7,
  depthMultiplier: 1.0,
  currentShape: 'square',
  is3DMode: true
});

// 5. Loop d'animation
function animate() {
  requestAnimationFrame(animate);
  museum.update();
  manager.update(0.016);
  museum.render();
}
animate();
```

### Projection sur une seule surface

```javascript
await manager.createProjection('SCREEN_FLOOR', video, true, {
  pointSize: 2.0,
  particleDensity: 10,
  currentShape: 'circle'
});
```

### Mettre à jour toutes les projections

```javascript
manager.updateAllProjectionsConfig({
  breathSpeed: 2.0,
  brightness: 2.5,
  flowIntensity: 1.5
});
```

### Supprimer une projection

```javascript
manager.removeProjection('SCREEN_FLOOR');
```

## 🎨 Personnalisation

### Modifier les dimensions du musée

Éditez `MUSEUM_COMPLETE.js` :

```javascript
const MUSEUM_CONFIG = {
  length: 900,      // Profondeur
  width: 700,       // Largeur
  height: 600,      // Hauteur
  wallHeight: 500,  // Hauteur des murs
  // ...
};
```

### Ajuster la caméra

```javascript
const CAMERA_CONFIG = {
  fov: 75,
  eyeHeight: 50,
  moveSpeed: 100,
  acceleration: 200,
  startPosition: { x: 0, y: 50, z: 400 }
};
```

## ⚠️ Points importants

1. **Serveur requis** : Les modules ES6 nécessitent un serveur HTTP
2. **CORS** : Les vidéos locales doivent être servies par le même serveur
3. **Performances** : Limiter la densité de particules (7-10x recommandé)
4. **Navigation** : Cliquer pour activer le PointerLock

## 🐛 Dépannage

### Les modules ne se chargent pas
- Vérifiez que vous utilisez un serveur HTTP
- Ouvrez la console (F12) pour voir les erreurs

### Les vidéos ne s'affichent pas
- Vérifiez le format (MP4/WebM recommandés)
- Vérifiez que la vidéo est servie par le même serveur

### Performance lente
- Réduisez `particleDensity` (essayez 5x)
- Réduisez `pointSize` (essayez 0.5)
- Désactivez le mode 3D

## 📄 Licence

Projet de recherche en design computationnel - Protocole Volumétrique v1.3.1

---

**Version** : Musée 3D v1.0
**Protocole** : Volumétrique v1.3.1 (luminance-based depth)
**Three.js** : 0.160.0
