/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MUSEUM PROJECTION MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Gère plusieurs projections volumétriques sur différentes surfaces du musée.
 * Permet de synchroniser ou désynchroniser les animations.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { VolumetricProtocol } from './VolumetricProtocol.js';

export class MuseumProjectionManager {
  constructor(museum) {
    this.museum = museum;
    this.scene = museum.getScene();
    this.projections = new Map(); // Map<screenId, { protocol, group, config }>
  }

  /**
   * Crée une projection sur une surface donnée
   * @param {string} screenId - ID de la surface ('SCREEN_FLOOR', 'SCREEN_WALL_LEFT', etc.)
   * @param {HTMLVideoElement|HTMLImageElement} media - Source média
   * @param {boolean} isVideo - true si c'est une vidéo
   * @param {object} config - Configuration du protocole volumétrique
   */
  async createProjection(screenId, media, isVideo = false, config = {}) {
    const screen = this.museum.getScreen(screenId);
    if (!screen) {
      console.error(`[MuseumProjectionManager] Screen not found: ${screenId}`);
      return null;
    }

    // Créer un groupe pour contenir la projection volumétrique
    const group = new THREE.Group();

    // Positionner le groupe au centre de la surface
    group.position.copy(screen.position);
    group.rotation.copy(screen.rotation);

    // Créer le protocole volumétrique
    const protocol = new VolumetricProtocol(group, config);

    // Charger le média
    await protocol.loadMedia(media, isVideo);

    // Ajouter le groupe à la scène
    this.scene.add(group);

    // Stocker la projection
    this.projections.set(screenId, {
      protocol,
      group,
      config,
      media,
      isVideo
    });

    console.log(`[MuseumProjectionManager] Projection created on ${screenId}`);
    return protocol;
  }

  /**
   * Charge la même vidéo sur plusieurs surfaces
   * @param {string[]} screenIds - Array des IDs de surfaces
   * @param {HTMLVideoElement} video - Vidéo source
   * @param {object} config - Configuration commune
   */
  async createSyncedProjections(screenIds, video, config = {}) {
    const promises = screenIds.map(screenId =>
      this.createProjection(screenId, video, true, config)
    );

    return Promise.all(promises);
  }

  /**
   * Met à jour toutes les projections (appelé dans la loop d'animation)
   * @param {number} delta - Temps écoulé depuis le dernier frame
   */
  update(delta) {
    this.projections.forEach((projection) => {
      projection.protocol.update(delta);
    });
  }

  /**
   * Met à jour la configuration d'une projection
   * @param {string} screenId - ID de la surface
   * @param {object} newConfig - Nouvelle configuration
   */
  updateProjectionConfig(screenId, newConfig) {
    const projection = this.projections.get(screenId);
    if (projection) {
      projection.protocol.setConfig(newConfig);
      projection.config = { ...projection.config, ...newConfig };
    }
  }

  /**
   * Met à jour la configuration de toutes les projections
   * @param {object} newConfig - Nouvelle configuration
   */
  updateAllProjectionsConfig(newConfig) {
    this.projections.forEach((projection, screenId) => {
      this.updateProjectionConfig(screenId, newConfig);
    });
  }

  /**
   * Supprime une projection
   * @param {string} screenId - ID de la surface
   */
  removeProjection(screenId) {
    const projection = this.projections.get(screenId);
    if (projection) {
      projection.protocol.dispose();
      this.scene.remove(projection.group);
      this.projections.delete(screenId);
      console.log(`[MuseumProjectionManager] Projection removed from ${screenId}`);
    }
  }

  /**
   * Supprime toutes les projections
   */
  removeAllProjections() {
    this.projections.forEach((_, screenId) => {
      this.removeProjection(screenId);
    });
  }

  /**
   * Récupère une projection spécifique
   * @param {string} screenId - ID de la surface
   * @returns {VolumetricProtocol|null}
   */
  getProjection(screenId) {
    const projection = this.projections.get(screenId);
    return projection ? projection.protocol : null;
  }

  /**
   * Liste toutes les projections actives
   * @returns {string[]} Array des IDs de surfaces avec projections
   */
  getActiveProjections() {
    return Array.from(this.projections.keys());
  }

  /**
   * Change la vidéo d'une projection existante
   * @param {string} screenId - ID de la surface
   * @param {HTMLVideoElement|HTMLImageElement} media - Nouvelle source
   * @param {boolean} isVideo - true si c'est une vidéo
   */
  async changeProjectionMedia(screenId, media, isVideo) {
    const projection = this.projections.get(screenId);
    if (projection) {
      await projection.protocol.loadMedia(media, isVideo);
      projection.media = media;
      projection.isVideo = isVideo;
    }
  }
}
