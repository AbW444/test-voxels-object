/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 PROTOCOLE VOLUMÉTRIQUE v1.3.1 - MODULE POUR MUSÉE 3D
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce module encapsule le protocole volumétrique v1.3.1 (luminance-based depth)
 * pour une utilisation dans le musée 3D.
 *
 * IMPORTANT : Ce protocole respecte EXACTEMENT les paramètres du v1.3.1:
 * - TARGET_SIZE = 1000 (fixe)
 * - scaleFactor = 0.5 (fixe)
 * - Luminance-based depth calculation
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';

export class VolumetricProtocol {
  constructor(scene, config = {}) {
    this.scene = scene;

    // Paramètres du protocole v1.3.1 (EXACTS)
    this.TARGET_SIZE = 1000;  // NE PAS MODIFIER
    this.scaleFactor = 0.5;    // NE PAS MODIFIER

    // Paramètres ajustables
    this.config = {
      pointSize: config.pointSize || 1.0,
      particleDensity: config.particleDensity || 7,
      depthMultiplier: config.depthMultiplier || 1.0,
      breathSpeed: config.breathSpeed || 1.0,
      brightness: config.brightness || 1.8,
      flowIntensity: config.flowIntensity || 0.0,
      hideBlack: config.hideBlack || false,
      blackThreshold: config.blackThreshold || 30,
      currentShape: config.currentShape || 'circle',
      is3DMode: config.is3DMode !== undefined ? config.is3DMode : false
    };

    // État interne
    this.particles = null;
    this.geometry = null;
    this.material = null;
    this.videoTexture = null;
    this.time = 0;

    // Video sampling data
    this.videoSamplingCanvas = null;
    this.videoSamplingCtx = null;
    this.videoSamplingData = null;

    // Flow movement data
    this.flowOffsets = null;

    // Media source
    this.currentMedia = null;
    this.isVideo = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHAPE TEXTURE GENERATORS
  // ═══════════════════════════════════════════════════════════════════════════

  createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  createSquareTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  createDiamondTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(64, 32);
    ctx.lineTo(32, 64);
    ctx.lineTo(0, 32);
    ctx.closePath();
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'white';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = 32 + Math.cos(angle) * 30;
      const y = 32 + Math.sin(angle) * 30;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  getShapeTexture(shape) {
    switch(shape) {
      case 'circle': return this.createCircleTexture();
      case 'square': return this.createSquareTexture();
      case 'diamond': return this.createDiamondTexture();
      case 'star': return this.createStarTexture();
      default: return this.createCircleTexture();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARGEMENT MÉDIA (image ou vidéo)
  // ═══════════════════════════════════════════════════════════════════════════

  async loadMedia(mediaSource, isVideo = false) {
    this.currentMedia = mediaSource;
    this.isVideo = isVideo;

    return this.generate(mediaSource);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GÉNÉRATION DU VOLUME (protocole v1.3.1 EXACT)
  // ═══════════════════════════════════════════════════════════════════════════

  generate(media) {
    if (!media) {
      console.warn('[VolumetricProtocol] No media provided');
      return;
    }

    const { pointSize, particleDensity, depthMultiplier, brightness, hideBlack, blackThreshold, currentShape, is3DMode } = this.config;

    // Normalize media to fixed size for consistent volume
    const TARGET_SIZE = this.TARGET_SIZE;  // 1000 (FIXE)
    const step = Math.max(1, Math.floor(10 / particleDensity));

    // Create or reuse sampling canvas
    if (!this.videoSamplingCanvas) {
      this.videoSamplingCanvas = document.createElement('canvas');
      this.videoSamplingCanvas.width = TARGET_SIZE;
      this.videoSamplingCanvas.height = TARGET_SIZE;
      this.videoSamplingCtx = this.videoSamplingCanvas.getContext('2d', { willReadFrequently: true });
    }

    const ctx = this.videoSamplingCtx;

    // Store sampling data for continuous updates
    this.videoSamplingData = {
      step: step,
      TARGET_SIZE: TARGET_SIZE,
      scaleFactor: this.scaleFactor,  // 0.5 (FIXE)
      halfSize: TARGET_SIZE / 2,
      depthMultiplier: depthMultiplier
    };

    // Get media dimensions
    let mediaWidth, mediaHeight;
    if (this.isVideo) {
      mediaWidth = media.videoWidth;
      mediaHeight = media.videoHeight;
    } else {
      mediaWidth = media.naturalWidth || media.width;
      mediaHeight = media.naturalHeight || media.height;
    }

    // Verify media has valid dimensions
    if (!mediaWidth || !mediaHeight || mediaWidth === 0 || mediaHeight === 0) {
      console.error('[VolumetricProtocol] Invalid media dimensions:', mediaWidth, 'x', mediaHeight);
      console.error('[VolumetricProtocol] Media:', this.isVideo ? 'Video' : 'Image');
      return;
    }

    console.log('[VolumetricProtocol] Media dimensions:', mediaWidth, 'x', mediaHeight);

    // Crop to center square and resize to TARGET_SIZE
    const sourceSize = Math.min(mediaWidth, mediaHeight);
    const offsetX = (mediaWidth - sourceSize) / 2;
    const offsetY = (mediaHeight - sourceSize) / 2;

    // Draw current frame to sample pixels
    ctx.drawImage(media, offsetX, offsetY, sourceSize, sourceSize, 0, 0, TARGET_SIZE, TARGET_SIZE);

    const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
    const data = imageData.data;

    // Create particle for each pixel
    const positions = [];
    const colors = [];
    const initialZ = [];

    const scaleFactor = this.scaleFactor;  // 0.5 (FIXE)
    const halfSize = TARGET_SIZE / 2;

    // TRUE CUBE: depth = width = height
    const depthSpread = TARGET_SIZE * scaleFactor * depthMultiplier;

    for (let y = 0; y < TARGET_SIZE; y += step) {
      for (let x = 0; x < TARGET_SIZE; x += step) {
        const i = (y * TARGET_SIZE + x) * 4;
        const alpha = data[i + 3];

        // Only create particle if pixel is visible
        if (alpha > 30) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const maxColor = Math.max(r, g, b);

          // Skip black particles if hideBlack is enabled
          if (hideBlack && maxColor < blackThreshold) {
            continue;
          }

          // Position
          const px = (x - halfSize) * scaleFactor;
          const py = -(y - halfSize) * scaleFactor;

          // v1.3.1 — Luminance-based depth (EXACT)
          const luminance = (r + g + b) / (3 * 255);
          const pz = (luminance - 0.5) * depthSpread;

          positions.push(px, py, pz);
          initialZ.push(pz);

          // Color directly from pixel with brightness boost
          colors.push(
            Math.min(1.0, (r / 255) * brightness),
            Math.min(1.0, (g / 255) * brightness),
            Math.min(1.0, (b / 255) * brightness)
          );
        }
      }
    }

    // Clean up previous particles
    if (this.particles) {
      this.scene.remove(this.particles);
      if (this.particles.geometry) this.particles.geometry.dispose();
      if (this.particles.material) {
        if (this.videoTexture) this.videoTexture.dispose();
        this.particles.material.dispose();
      }
    }

    if (is3DMode) {
      // 3D Mode: Use InstancedMesh with real 3D geometries
      const count = positions.length / 3;
      let baseGeometry;
      const size = pointSize * 3;

      switch(currentShape) {
        case 'square':
          baseGeometry = new THREE.BoxGeometry(size, size, size);
          break;
        case 'circle':
          baseGeometry = new THREE.SphereGeometry(size * 0.5, 8, 6);
          break;
        case 'diamond':
          baseGeometry = new THREE.OctahedronGeometry(size * 0.5);
          break;
        case 'star':
          baseGeometry = new THREE.TetrahedronGeometry(size * 0.6);
          break;
        default:
          baseGeometry = new THREE.SphereGeometry(size * 0.5, 8, 6);
      }

      this.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: true,
        roughness: 0.7,
        metalness: 0.3,
        emissive: 0x000000,
        emissiveIntensity: 0.2
      });

      this.particles = new THREE.InstancedMesh(baseGeometry, this.material, count);
      this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const instanceColors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        instanceColors[i * 3] = colors[i * 3];
        instanceColors[i * 3 + 1] = colors[i * 3 + 1];
        instanceColors[i * 3 + 2] = colors[i * 3 + 2];
      }
      this.particles.instanceColor = new THREE.InstancedBufferAttribute(instanceColors, 3);

      const matrix = new THREE.Matrix4();
      const color = new THREE.Color();

      for (let i = 0; i < count; i++) {
        matrix.setPosition(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2]
        );
        this.particles.setMatrixAt(i, matrix);
        color.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        this.particles.setColorAt(i, color);
      }

      this.particles.instanceMatrix.needsUpdate = true;

      this.particles.userData.initialZ = initialZ;
      this.particles.userData.positions = positions;
      this.particles.userData.is3D = true;

    } else {
      // 2D Mode: Use Points
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      this.geometry.setAttribute('initialZ', new THREE.Float32BufferAttribute(initialZ, 1));

      // Create texture based on media type
      if (this.isVideo) {
        this.videoTexture = new THREE.VideoTexture(media);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
      }

      const shapeTexture = this.getShapeTexture(currentShape);

      this.material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: true,
        map: shapeTexture
      });

      this.particles = new THREE.Points(this.geometry, this.material);
    }

    this.scene.add(this.particles);

    // Initialize flow offsets - random circular movement for each particle
    const particleCount = positions.length / 3;
    this.flowOffsets = [];
    for (let i = 0; i < particleCount; i++) {
      this.flowOffsets.push({
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speedX: 0.3 + Math.random() * 0.7,
        speedY: 0.3 + Math.random() * 0.7,
        radiusX: 2 + Math.random() * 8,
        radiusY: 2 + Math.random() * 8
      });
    }

    console.log(`[VolumetricProtocol] Generated ${particleCount} particles`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE COLORS FROM VIDEO (real-time)
  // ═══════════════════════════════════════════════════════════════════════════

  updateColorsFromVideo() {
    if (!this.currentMedia || !this.isVideo || !this.videoSamplingCanvas || !this.videoSamplingData || !this.particles) return;

    const { step, TARGET_SIZE, scaleFactor, halfSize, depthMultiplier } = this.videoSamplingData;
    const { brightness, hideBlack, blackThreshold } = this.config;

    // Get media dimensions
    const mediaWidth = this.currentMedia.videoWidth;
    const mediaHeight = this.currentMedia.videoHeight;
    const sourceSize = Math.min(mediaWidth, mediaHeight);
    const offsetX = (mediaWidth - sourceSize) / 2;
    const offsetY = (mediaHeight - sourceSize) / 2;

    this.videoSamplingCtx.drawImage(this.currentMedia, offsetX, offsetY, sourceSize, sourceSize, 0, 0, TARGET_SIZE, TARGET_SIZE);
    const imageData = this.videoSamplingCtx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE);
    const data = imageData.data;

    // Calculate depth spread (same as in generate)
    const depthSpread = TARGET_SIZE * scaleFactor * depthMultiplier;

    // Collect new colors and depths
    const newColors = [];
    const newDepths = [];
    for (let y = 0; y < TARGET_SIZE; y += step) {
      for (let x = 0; x < TARGET_SIZE; x += step) {
        const i = (y * TARGET_SIZE + x) * 4;
        const alpha = data[i + 3];

        if (alpha > 30) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const maxColor = Math.max(r, g, b);

          // v1.3.1 — Update luminance-based depth in real-time
          const luminance = (r + g + b) / (3 * 255);
          const pz = (luminance - 0.5) * depthSpread;
          newDepths.push(pz);

          // Skip if hideBlack and below threshold (but keep same particle count)
          if (hideBlack && maxColor < blackThreshold) {
            newColors.push(0, 0, 0);
          } else {
            // Update color with brightness boost
            newColors.push(
              Math.min(1.0, (r / 255) * brightness),
              Math.min(1.0, (g / 255) * brightness),
              Math.min(1.0, (b / 255) * brightness)
            );
          }
        }
      }
    }

    // Update colors and depths based on mode
    if (this.config.is3DMode && this.particles.instanceColor) {
      // 3D Mode: Update instance colors and initial depths
      const colors = this.particles.instanceColor.array;
      for (let i = 0; i < newColors.length; i++) {
        colors[i] = newColors[i];
      }
      this.particles.instanceColor.needsUpdate = true;

      // Update initialZ for depth animation
      if (this.particles.userData.initialZ) {
        for (let i = 0; i < newDepths.length; i++) {
          this.particles.userData.initialZ[i] = newDepths[i];
        }
      }
    } else if (this.geometry && this.geometry.attributes.color) {
      // 2D Mode: Update vertex colors and initial depths
      const colors = this.geometry.attributes.color.array;
      for (let i = 0; i < newColors.length; i++) {
        colors[i] = newColors[i];
      }
      this.geometry.attributes.color.needsUpdate = true;

      // Update initialZ attribute for depth animation
      if (this.geometry.attributes.initialZ) {
        const initialZArray = this.geometry.attributes.initialZ.array;
        for (let i = 0; i < newDepths.length; i++) {
          initialZArray[i] = newDepths[i];
        }
        this.geometry.attributes.initialZ.needsUpdate = true;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE ANIMATION (breathing + flow)
  // ═══════════════════════════════════════════════════════════════════════════

  update(delta) {
    const { breathSpeed, flowIntensity } = this.config;

    this.time += 0.001 * breathSpeed;

    // Update particle colors from current video frame
    if (this.currentMedia && this.isVideo) {
      this.updateColorsFromVideo();
    }

    // Update video texture
    if (this.videoTexture && this.currentMedia && this.isVideo) {
      this.videoTexture.needsUpdate = true;
    }

    if (this.particles && this.flowOffsets) {
      if (this.particles.userData && this.particles.userData.is3D) {
        // 3D Mode: Update instance matrices for breathing and flow animation
        const initialZs = this.particles.userData.initialZ;
        const positions = this.particles.userData.positions;

        if (initialZs && positions && initialZs.length > 0) {
          const matrix = new THREE.Matrix4();
          const epsilon = 0.3 * breathSpeed;

          for (let i = 0; i < initialZs.length; i++) {
            const breathOffset = Math.sin(this.time + i * 0.01) * epsilon;
            const newZ = initialZs[i] + breathOffset;

            // Flow movement - circular organic motion
            let flowX = 0, flowY = 0;
            if (flowIntensity > 0 && this.flowOffsets[i]) {
              const offset = this.flowOffsets[i];
              flowX = Math.sin(this.time * offset.speedX + offset.phaseX) * offset.radiusX * flowIntensity;
              flowY = Math.cos(this.time * offset.speedY + offset.phaseY) * offset.radiusY * flowIntensity;
            }

            matrix.setPosition(
              positions[i * 3] + flowX,
              positions[i * 3 + 1] + flowY,
              newZ
            );
            this.particles.setMatrixAt(i, matrix);
          }
          this.particles.instanceMatrix.needsUpdate = true;
        }
      } else if (this.geometry && this.geometry.attributes.position) {
        // 2D Mode: Update position attribute for breathing and flow animation
        const positions = this.geometry.attributes.position.array;
        const initialZs = this.geometry.attributes.initialZ.array;

        // Store initial positions if not already stored
        if (!this.geometry.userData.initialPositions) {
          this.geometry.userData.initialPositions = new Float32Array(positions.length);
          for (let i = 0; i < positions.length; i++) {
            this.geometry.userData.initialPositions[i] = positions[i];
          }
        }

        const initialPositions = this.geometry.userData.initialPositions;

        for (let i = 0; i < positions.length / 3; i++) {
          const epsilon = 0.3 * breathSpeed;
          const breathOffset = Math.sin(this.time + i * 0.01) * epsilon;

          // Flow movement - circular organic motion
          let flowX = 0, flowY = 0;
          if (flowIntensity > 0 && this.flowOffsets[i]) {
            const offset = this.flowOffsets[i];
            flowX = Math.sin(this.time * offset.speedX + offset.phaseX) * offset.radiusX * flowIntensity;
            flowY = Math.cos(this.time * offset.speedY + offset.phaseY) * offset.radiusY * flowIntensity;
          }

          positions[i * 3] = initialPositions[i * 3] + flowX;
          positions[i * 3 + 1] = initialPositions[i * 3 + 1] + flowY;
          positions[i * 3 + 2] = initialZs[i] + breathOffset;
        }

        this.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (this.currentMedia) {
      this.generate(this.currentMedia);
    }
  }

  dispose() {
    if (this.particles) {
      this.scene.remove(this.particles);
      if (this.particles.geometry) this.particles.geometry.dispose();
      if (this.particles.material) {
        if (this.videoTexture) this.videoTexture.dispose();
        this.particles.material.dispose();
      }
    }

    this.particles = null;
    this.geometry = null;
    this.material = null;
    this.videoTexture = null;
    this.videoSamplingCanvas = null;
    this.videoSamplingCtx = null;
    this.videoSamplingData = null;
    this.flowOffsets = null;
  }
}
