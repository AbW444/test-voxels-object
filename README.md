# Volumetric Particle Visualization System

## Recherche en design computationnel et visualisation volumétrique

---

## Vue d'ensemble

Ce projet est une expérimentation de recherche en design numérique relevant du champ du **design computationnel** et de la **visualisation volumétrique par particules**. Il repose exclusivement sur **Three.js** et **THREE.Points** (nuages de particules), sans recourir à des meshes, surfaces ou géométries traditionnelles.

### Principe fondamental

Le système transforme des images 2D en un **volume particulaire unique** où chaque particule porte simultanément plusieurs états visuels. Ces états se révèlent progressivement selon la **profondeur Z**, l'orientation ou le point de vue, créant une expérience volumétrique organique et continue.

**Il ne s'agit pas d'images plaquées sur des faces**, mais d'**états internes du volume** qui émergent par interpolation continue.

---

## Architecture technique

### Paradigme volumétrique

- **Un volume unique** : Un seul système de particules (THREE.Points)
- **Particules multi-états** : Chaque particule porte deux informations colorimétriques (colorA, colorB)
- **Interpolation profondeur** : La couleur finale dépend de la position Z via shaders custom
- **Rendu diffus** : Aspect granulaire, organique, sans surface plane identifiable

### Structure du code

```
/
├── index.html              # Structure HTML épurée
├── css/
│   └── style.css          # Esthétique minimaliste noir/blanc
├── js/
│   ├── VolumetricParticles.js  # Classe principale du système
│   └── main.js            # Orchestration et interface
└── README.md
```

---

## Fonctionnement technique détaillé

### 1. Chargement des images

Le système charge **deux images sources** (A et B) via drag & drop ou sélection de fichiers :

- Recadrage automatique au format carré
- Extraction des données pixel via Canvas API
- Normalisation des résolutions

### 2. Génération du volume particulaire

Chaque pixel des deux images devient une **particule unique** dans l'espace 3D :

```javascript
// Position (x, y) issue de la grille de l'image
const px = x - halfRes;
const py = -(y - halfRes);

// Position Z : distribution gaussienne contrôlée
const pz = generateZPosition(); // Distribution organique

// Deux couleurs par particule
colorA = pixelImageA(x, y);
colorB = pixelImageB(x, y);
```

### 3. Système de shaders custom

#### Vertex Shader

Transmet les données de couleurs et de position au fragment shader :

```glsl
attribute vec3 colorA;
attribute vec3 colorB;

varying vec3 vColorA;
varying vec3 vColorB;
varying float vPositionZ;

void main() {
    vColorA = colorA;
    vColorB = colorB;
    vPositionZ = position.z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = pointSize * (300.0 / -mvPosition.z);
}
```

#### Fragment Shader

Calcule l'interpolation entre les deux couleurs selon la profondeur Z :

```glsl
varying vec3 vColorA;
varying vec3 vColorB;
varying float vPositionZ;

uniform float interpolationPower;
uniform float interpolationCenter;
uniform float zDispersion;

void main() {
    // Normalisation de Z
    float normalizedZ = (vPositionZ - interpolationCenter) / zDispersion;

    // Facteur d'interpolation [0, 1]
    float t = clamp(normalizedZ * 0.5 + 0.5, 0.0, 1.0);
    t = pow(t, interpolationPower);

    // Interpolation linéaire
    vec3 finalColor = mix(vColorA, vColorB, t);

    gl_FragColor = vec4(finalColor, alpha);
}
```

**Logique d'interpolation :**

- `t = 0` → Image A dominante (arrière du volume)
- `t = 0.5` → Transition équilibrée
- `t = 1` → Image B dominante (avant du volume)

### 4. BufferAttributes

Deux attributs distincts stockent les couleurs :

```javascript
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('colorA', new THREE.BufferAttribute(colorsA, 3));
geometry.setAttribute('colorB', new THREE.BufferAttribute(colorsB, 3));
```

---

## Interface utilisateur

### Esthétique

- Arrière-plan blanc
- Typographie noire grande taille (haut gauche)
- Panneau de contrôle minimaliste (droite)
- Esthétique moderne noir/blanc

### Contrôles paramétriques

| Paramètre | Fonction | Effet |
|-----------|----------|-------|
| **Densité de particules** | Facteur de subdivision (1-10) | Nombre de particules générées |
| **Dispersion Z** | Profondeur du volume (0-200) | Épaisseur du champ particulaire |
| **Taille des particules** | Dimension visuelle (0.5-5) | Granularité du rendu |
| **Intensité d'interpolation** | Puissance de la transition (0.1-5) | Douceur/netteté du gradient |
| **Centre d'interpolation** | Offset du point médian (-100 à +100) | Position de la transition |
| **Rotation automatique** | Vitesse angulaire (0-2) | Animation continue |

### Manipulation

- **Rotation** : Clic gauche + glisser
- **Zoom** : Molette de la souris
- **Pan** : Clic droit + glisser

---

## Utilisation

### 1. Ouverture

Ouvrir `index.html` dans un navigateur moderne (Chrome, Firefox, Edge)

### 2. Chargement des images

- Glisser-déposer deux images dans les zones dédiées
- **Ou** cliquer sur les slots pour sélectionner des fichiers
- Format recommandé : **1080×1080px** (carré)

### 3. Exploration

Une fois les images chargées :

- Le volume apparaît au centre de l'écran
- Les contrôles deviennent accessibles
- Manipuler la caméra pour explorer le volume à 360°
- Ajuster les paramètres pour expérimenter

### 4. Réinitialisation

Bouton **"Réinitialiser les images"** pour recommencer avec de nouvelles images.

---

## Concepts de recherche

### Principe volumétrique vs surfaces

**Ce qui est évité** (approche traditionnelle) :
- ❌ Images plaquées sur des faces de cube
- ❌ Textures projetées sur des plans
- ❌ Géométries visibles (BoxGeometry, voxels)
- ❌ Transitions abruptes entre états

**Ce qui est recherché** (approche volumétrique) :
- ✅ Champ particulaire diffus et organique
- ✅ États visuels internes au volume
- ✅ Transitions continues selon la profondeur
- ✅ Perception non-objectale, granulaire

### Interpolation multi-états

Le volume ne contient pas "deux images séparées" mais un **continuum d'états visuels** :

```
Zone arrière (Z < 0) ──────→ Zone avant (Z > 0)
    Image A pure              Image B pure
         ↓                         ↓
    [Transition progressive graduelle]
              ↓
    Perception d'un volume unique
```

### Distribution spatiale

La position Z de chaque particule suit une **distribution gaussienne** (Box-Muller transform) :

```javascript
const gaussian = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
const pz = gaussian * zDispersion * 0.3;
```

Cela crée un effet plus **organique et naturel** qu'une distribution uniforme.

---

## Dépendances

- **Three.js** r152 (via CDN)
- Navigateur avec support WebGL

Aucune installation npm requise. Projet autonome.

---

## Performance

### Optimisations implémentées

- Discard des fragments transparents dans le shader
- `depthWrite: false` pour transparence
- Calcul de `gl_PointSize` avec perspective
- Distribution adaptative selon la densité

### Nombre de particules

Avec une image 1080×1080 et densité 4 :

```
Particules ≈ (1080 / step)²
          ≈ (1080 / 2.5)²
          ≈ 186,000 particules
```

Performances testées sur GPU moderne : **60 FPS stable**

---

## Cas d'usage de recherche

1. **Exploration de la perception visuelle volumétrique**
   - Comment les images sont-elles perçues dans un espace non-plan ?

2. **Étude des transitions continues**
   - Quel est le seuil de perception entre deux états visuels ?

3. **Prototypage de systèmes particulaires expressifs**
   - Au-delà de la modélisation géométrique traditionnelle

4. **Recherche en design computationnel**
   - Nouvelles formes de représentation visuelle

---

## Limites et perspectives

### Limites actuelles

- Deux images sources maximum (extensible à N images)
- Interpolation linéaire uniquement
- Pas de persistance des paramètres

### Extensions possibles

1. **Multi-images** : Support de 3+ images avec interpolation tri-dimensionnelle
2. **Interpolation non-linéaire** : Courbes de Bézier, easing functions
3. **Modes de blend** : Multiplicatif, additif, écran
4. **Animation temporelle** : Morphing entre états
5. **Export** : Capture vidéo, séquences d'images
6. **Présets** : Sauvegarde/chargement de configurations

---

## Licence

Projet de recherche académique.

---

## Contact

Pour toute question sur l'implémentation technique ou les concepts de design computationnel abordés dans ce projet.

---

**Version :** 1.0
**Date :** Décembre 2024
**Technologie :** Three.js r152, WebGL, GLSL
