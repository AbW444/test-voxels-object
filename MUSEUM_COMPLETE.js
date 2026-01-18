/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ MUSÉE 3D - TEMPLATE COMPLET TOUT-EN-UN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce fichier contient TOUT ce dont vous avez besoin pour créer un musée 3D :
 * - Structure complète du musée (géométrie, piliers, plafond)
 * - 4 surfaces de projection pré-positionnées
 * - Système de navigation FPS
 * - Éclairage configuré
 * - Documentation complète
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📖 DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DIMENSIONS DU MUSÉE (modifiables dans MUSEUM_CONFIG) :
 * - Longueur : 900 unités (axe Z)
 * - Largeur : 700 unités (axe X)
 * - Hauteur : 600 unités (axe Y)
 * - Hauteur murs : 500 unités (surfaces de projection)
 *
 * SURFACES DE PROJECTION DISPONIBLES :
 * ┌─────────────────┬──────────────────┬─────────────────┬───────────────┐
 * │ ID              │ Position         │ Rotation        │ Dimensions    │
 * ├─────────────────┼──────────────────┼─────────────────┼───────────────┤
 * │ SCREEN_FLOOR    │ (0, 1, 0)        │ x: -90°         │ 560×540       │
 * │ SCREEN_WALL_LEFT│ (-345, 250, 0)   │ y: 90°          │ 500×720       │
 * │ SCREEN_WALL_RIGHT│ (345, 250, 0)   │ y: -90°         │ 500×720       │
 * │ SCREEN_WALL_BACK│ (0, 250, -445)   │ y: 0°           │ 560×500       │
 * └─────────────────┴──────────────────┴─────────────────┴───────────────┘
 *
 * CONTRÔLES UTILISATEUR :
 * - ZQSD / WASD / Flèches : Déplacement
 * - Souris : Orientation de la caméra
 * - Clic gauche : Activer la navigation
 * - ESC : Désactiver la navigation
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - Modifiez ces valeurs selon vos besoins
// ═══════════════════════════════════════════════════════════════════════════

const MUSEUM_CONFIG = {
  // Dimensions de la salle (en unités Three.js)
  length: 900,        // Longueur (axe Z) - profondeur
  width: 700,         // Largeur (axe X) - gauche-droite
  height: 600,        // Hauteur totale (axe Y)
  wallHeight: 500,    // Hauteur des surfaces de projection

  // Structure interne
  centralAisle: 200,  // Largeur de l'allée centrale
  wallWidth: 250,     // Largeur des zones latérales

  // Piliers verticaux décoratifs
  pillar: {
    width: 5,
    depth: 2,
    spacing: 150,     // Espacement entre piliers
  },

  // Plafond technique (structure truss)
  ceiling: {
    trussRadius: 3,
    trussSpacing: 80,
    trussCount: 5,    // Nombre de rails parallèles
  }
};

const CAMERA_CONFIG = {
  fov: 75,            // Field of view
  near: 0.1,          // Near clipping plane
  far: 2000,          // Far clipping plane

  // Navigation FPS
  eyeHeight: 50,             // Hauteur des yeux du visiteur
  moveSpeed: 100,            // Vitesse max de déplacement
  acceleration: 200,         // Accélération
  friction: 150,             // Friction (ralentissement)
  mouseSensitivity: 0.002,   // Sensibilité de la souris

  // Position de départ
  startPosition: {
    x: 0,
    y: 50,
    z: 400              // Recul pour voir toute la scène
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPALE : MUSEUM SCENE
// ═══════════════════════════════════════════════════════════════════════════

export class MuseumScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.screenMeshes = new Map(); // Stockage des surfaces de projection

    // Navigation FPS
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false
    };
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.clock = new THREE.Clock();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALISATION
  // ═══════════════════════════════════════════════════════════════════════════

  init(containerElement) {
    console.log('[MuseumScene] Initialisation...');

    // 1. Setup renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    containerElement.appendChild(this.renderer.domElement);

    // 2. Setup camera
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      window.innerWidth / window.innerHeight,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far
    );
    this.camera.position.set(
      CAMERA_CONFIG.startPosition.x,
      CAMERA_CONFIG.startPosition.y,
      CAMERA_CONFIG.startPosition.z
    );

    // 3. Setup controls
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.getObject());

    // 4. Build museum structure
    this.buildMuseum();

    // 5. Setup lighting
    this.setupLighting();

    // 6. Setup interactions
    this.setupInteractions();

    // 7. Window resize handler
    window.addEventListener('resize', () => this.onWindowResize());

    console.log('[MuseumScene] ✓ Initialized');
    console.log('[MuseumScene] Surfaces disponibles:', Array.from(this.screenMeshes.keys()));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTION DE LA STRUCTURE DU MUSÉE
  // ═══════════════════════════════════════════════════════════════════════════

  buildMuseum() {
    const { length, width, height, wallHeight, centralAisle, wallWidth } = MUSEUM_CONFIG;

    // ─────────────────────────────────────────────────────────────────────────
    // SOL
    // ─────────────────────────────────────────────────────────────────────────
    const floorGeometry = new THREE.PlaneGeometry(width, length);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,      // Gris très foncé
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Surface de projection SOL (transparente, utilisable pour contenus)
    const screenFloorGeometry = new THREE.PlaneGeometry(width * 0.8, length * 0.6);
    const screenMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    const screenFloor = new THREE.Mesh(screenFloorGeometry, screenMaterial);
    screenFloor.rotation.x = -Math.PI / 2;
    screenFloor.position.y = 1; // Légèrement au-dessus pour éviter z-fighting
    screenFloor.name = 'SCREEN_FLOOR';
    this.scene.add(screenFloor);
    this.screenMeshes.set('SCREEN_FLOOR', screenFloor);

    // ─────────────────────────────────────────────────────────────────────────
    // MURS LATÉRAUX (GAUCHE et DROITE)
    // ─────────────────────────────────────────────────────────────────────────

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,      // Noir presque pur
      roughness: 0.9,
      metalness: 0.0
    });

    // Mur gauche - Structure
    const wallLeftBottomGeo = new THREE.BoxGeometry(2, wallHeight, length);
    const wallLeftBottom = new THREE.Mesh(wallLeftBottomGeo, wallMaterial);
    wallLeftBottom.position.set(-width/2, wallHeight/2, 0);
    this.scene.add(wallLeftBottom);

    // Surface de projection MUR GAUCHE
    const screenLeftGeo = new THREE.PlaneGeometry(wallHeight, length * 0.8);
    const screenLeft = new THREE.Mesh(screenLeftGeo, screenMaterial.clone());
    screenLeft.rotation.y = Math.PI / 2;
    screenLeft.position.set(-width/2 + 5, wallHeight/2, 0);
    screenLeft.name = 'SCREEN_WALL_LEFT';
    this.scene.add(screenLeft);
    this.screenMeshes.set('SCREEN_WALL_LEFT', screenLeft);

    // Mur droit - Structure
    const wallRightBottom = new THREE.Mesh(wallLeftBottomGeo, wallMaterial);
    wallRightBottom.position.set(width/2, wallHeight/2, 0);
    this.scene.add(wallRightBottom);

    // Surface de projection MUR DROIT
    const screenRight = new THREE.Mesh(screenLeftGeo, screenMaterial.clone());
    screenRight.rotation.y = -Math.PI / 2;
    screenRight.position.set(width/2 - 5, wallHeight/2, 0);
    screenRight.name = 'SCREEN_WALL_RIGHT';
    this.scene.add(screenRight);
    this.screenMeshes.set('SCREEN_WALL_RIGHT', screenRight);

    // ─────────────────────────────────────────────────────────────────────────
    // MUR DU FOND
    // ─────────────────────────────────────────────────────────────────────────
    const wallBackGeo = new THREE.BoxGeometry(width, wallHeight, 2);
    const wallBack = new THREE.Mesh(wallBackGeo, wallMaterial);
    wallBack.position.set(0, wallHeight/2, -length/2);
    this.scene.add(wallBack);

    // Surface de projection MUR FOND
    const screenBackGeo = new THREE.PlaneGeometry(width * 0.8, wallHeight);
    const screenBack = new THREE.Mesh(screenBackGeo, screenMaterial.clone());
    screenBack.position.set(0, wallHeight/2, -length/2 + 5);
    screenBack.name = 'SCREEN_WALL_BACK';
    this.scene.add(screenBack);
    this.screenMeshes.set('SCREEN_WALL_BACK', screenBack);

    // ─────────────────────────────────────────────────────────────────────────
    // PILIERS VERTICAUX
    // ─────────────────────────────────────────────────────────────────────────
    this.buildPillars();

    // ─────────────────────────────────────────────────────────────────────────
    // PLAFOND TECHNIQUE
    // ─────────────────────────────────────────────────────────────────────────
    this.buildCeiling();

    console.log('[MuseumScene] ✓ Structure built');
  }

  buildPillars() {
    const { width, wallHeight, pillar, length } = MUSEUM_CONFIG;

    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,      // Noir pur
      roughness: 0.7,
      metalness: 0.2
    });

    const pillarGeometry = new THREE.BoxGeometry(
      pillar.width,
      wallHeight,
      pillar.depth
    );

    // Calculer le nombre de piliers nécessaires
    const pillarCount = Math.floor(length / pillar.spacing);

    for (let i = -pillarCount; i <= pillarCount; i++) {
      const z = i * pillar.spacing;

      // Pilier gauche
      const pillarLeft = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillarLeft.position.set(-width/2 + 10, wallHeight/2, z);
      this.scene.add(pillarLeft);

      // Pilier droit
      const pillarRight = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillarRight.position.set(width/2 - 10, wallHeight/2, z);
      this.scene.add(pillarRight);
    }

    console.log('[MuseumScene] ✓ Pillars built:', pillarCount * 2);
  }

  buildCeiling() {
    const { width, length, height, ceiling } = MUSEUM_CONFIG;

    const trussMaterial = new THREE.MeshStandardMaterial({
      color: 0x202020,      // Gris anthracite
      roughness: 0.6,
      metalness: 0.3
    });

    // Rails parallèles (direction Z)
    for (let i = 0; i < ceiling.trussCount; i++) {
      const x = -width/2 + (i / (ceiling.trussCount - 1)) * width;

      const trussGeometry = new THREE.CylinderGeometry(
        ceiling.trussRadius,
        ceiling.trussRadius,
        length,
        8
      );

      const truss = new THREE.Mesh(trussGeometry, trussMaterial);
      truss.position.set(x, height - 20, 0);
      truss.rotation.x = Math.PI / 2;
      this.scene.add(truss);
    }

    // Barres transversales (direction X)
    const crossbarCount = Math.floor(length / ceiling.trussSpacing);
    for (let i = -crossbarCount; i <= crossbarCount; i++) {
      const z = i * ceiling.trussSpacing;

      const crossbarGeo = new THREE.CylinderGeometry(
        ceiling.trussRadius,
        ceiling.trussRadius,
        width,
        8
      );

      const crossbar = new THREE.Mesh(crossbarGeo, trussMaterial);
      crossbar.position.set(0, height - 20, z);
      crossbar.rotation.z = Math.PI / 2;
      this.scene.add(crossbar);
    }

    console.log('[MuseumScene] ✓ Ceiling built');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉCLAIRAGE
  // ═══════════════════════════════════════════════════════════════════════════

  setupLighting() {
    // Lumière ambiante douce
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);

    // Lumières directionnelles depuis le plafond
    const spotLight1 = new THREE.SpotLight(0xffffff, 0.5);
    spotLight1.position.set(0, MUSEUM_CONFIG.height - 50, 0);
    spotLight1.castShadow = true;
    this.scene.add(spotLight1);

    const spotLight2 = new THREE.SpotLight(0xffffff, 0.3);
    spotLight2.position.set(-200, MUSEUM_CONFIG.height - 50, -200);
    this.scene.add(spotLight2);

    const spotLight3 = new THREE.SpotLight(0xffffff, 0.3);
    spotLight3.position.set(200, MUSEUM_CONFIG.height - 50, -200);
    this.scene.add(spotLight3);

    console.log('[MuseumScene] ✓ Lighting setup');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERACTIONS & CONTRÔLES
  // ═══════════════════════════════════════════════════════════════════════════

  setupInteractions() {
    // Click pour activer le Pointer Lock
    document.addEventListener('click', () => {
      if (!this.controls.isLocked) {
        this.controls.lock();
      }
    });

    // Masquer les instructions au lock
    this.controls.addEventListener('lock', () => {
      const instructions = document.getElementById('instructions');
      if (instructions) instructions.classList.add('hidden');
    });

    this.controls.addEventListener('unlock', () => {
      const instructions = document.getElementById('instructions');
      if (instructions) instructions.classList.remove('hidden');
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    console.log('[MuseumScene] ✓ Controls setup');
  }

  onKeyDown(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
      case 'KeyZ': // AZERTY
        this.moveState.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveState.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
      case 'KeyQ': // AZERTY
        this.moveState.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveState.right = true;
        break;
      case 'Escape':
        if (this.controls.isLocked) {
          this.controls.unlock();
        }
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
      case 'KeyZ':
        this.moveState.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveState.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
      case 'KeyQ':
        this.moveState.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveState.right = false;
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  update() {
    const delta = this.clock.getDelta();

    if (this.controls.isLocked) {
      // Calcul de la direction de mouvement
      this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
      this.direction.x = Number(this.moveState.right) - Number(this.moveState.left);
      this.direction.normalize();

      // Application de l'accélération
      const acceleration = CAMERA_CONFIG.acceleration;
      const friction = CAMERA_CONFIG.friction;

      if (this.moveState.forward || this.moveState.backward) {
        this.velocity.z -= this.direction.z * acceleration * delta;
      } else {
        this.velocity.z *= Math.max(0, 1 - friction * delta);
      }

      if (this.moveState.left || this.moveState.right) {
        this.velocity.x -= this.direction.x * acceleration * delta;
      } else {
        this.velocity.x *= Math.max(0, 1 - friction * delta);
      }

      // Limiter la vitesse max
      const maxSpeed = CAMERA_CONFIG.moveSpeed;
      if (this.velocity.length() > maxSpeed) {
        this.velocity.setLength(maxSpeed);
      }

      // Appliquer le mouvement
      this.controls.moveRight(-this.velocity.x * delta);
      this.controls.moveForward(-this.velocity.z * delta);

      // Maintenir la hauteur constante (pas de vol)
      this.camera.position.y = CAMERA_CONFIG.eyeHeight;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API PUBLIQUE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Récupère une surface de projection par son ID
   * @param {string} screenId - ID de la surface ('SCREEN_FLOOR', 'SCREEN_WALL_LEFT', etc.)
   * @returns {THREE.Mesh} Le mesh de la surface de projection
   */
  getScreen(screenId) {
    return this.screenMeshes.get(screenId);
  }

  /**
   * Liste de toutes les surfaces disponibles
   * @returns {string[]} Tableau des IDs de surfaces
   */
  getAvailableScreens() {
    return Array.from(this.screenMeshes.keys());
  }

  /**
   * Accès direct à la scène Three.js pour ajouts custom
   * @returns {THREE.Scene}
   */
  getScene() {
    return this.scene;
  }

  /**
   * Accès à la caméra
   * @returns {THREE.PerspectiveCamera}
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Accès au renderer
   * @returns {THREE.WebGLRenderer}
   */
  getRenderer() {
    return this.renderer;
  }
}
