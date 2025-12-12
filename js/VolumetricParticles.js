/**
 * VolumetricParticles.js
 * =====================
 * Système de visualisation volumétrique par particules
 * avec interpolation multi-états basée sur la profondeur Z
 *
 * Principe conceptuel :
 * - Un volume unique de particules (THREE.Points)
 * - Chaque particule porte deux informations colorimétriques (colorA, colorB)
 * - La couleur finale est interpolée selon la position Z
 * - Rendu strictement volumétrique, sans faces ni surfaces
 */

class VolumetricParticles {
    constructor(scene) {
        this.scene = scene;
        this.particleSystem = null;
        this.geometry = null;
        this.material = null;

        // Paramètres volumétriques
        this.params = {
            particleDensity: 4,           // Facteur de densité (1-10)
            zDispersion: 50,              // Dispersion en profondeur
            pointSize: 1.5,               // Taille des particules
            interpolationPower: 1.0,      // Intensité de l'interpolation
            interpolationCenter: 0,       // Centre de l'interpolation en Z
            autoRotationSpeed: 0          // Vitesse de rotation automatique
        };

        // Images sources
        this.imageA = null;
        this.imageB = null;
        this.imageDataA = null;
        this.imageDataB = null;
        this.resolution = 0;
    }

    /**
     * Shaders custom pour l'interpolation volumétrique
     * Le vertex shader transmet les données au fragment shader
     * Le fragment shader calcule l'interpolation selon Z
     */
    getVertexShader() {
        return `
            // Attributes : deux couleurs par particule
            attribute vec3 colorA;
            attribute vec3 colorB;

            // Uniforms
            uniform float pointSize;

            // Varying : données transmises au fragment shader
            varying vec3 vColorA;
            varying vec3 vColorB;
            varying float vPositionZ;
            varying float vDistanceToCamera;

            void main() {
                // Transmission des couleurs
                vColorA = colorA;
                vColorB = colorB;

                // Position Z dans l'espace monde (pour interpolation)
                vPositionZ = position.z;

                // Calcul de la position dans l'espace écran
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;

                // Distance à la caméra (pour effet de profondeur optionnel)
                vDistanceToCamera = -mvPosition.z;

                // Taille des points (avec perspective)
                gl_PointSize = pointSize * (300.0 / -mvPosition.z);
            }
        `;
    }

    getFragmentShader() {
        return `
            // Varying : données reçues du vertex shader
            varying vec3 vColorA;
            varying vec3 vColorB;
            varying float vPositionZ;
            varying float vDistanceToCamera;

            // Uniforms pour le contrôle de l'interpolation
            uniform float interpolationPower;
            uniform float interpolationCenter;
            uniform float zDispersion;

            void main() {
                // Calcul du facteur d'interpolation basé sur Z
                // Normalisation de la position Z par rapport à la dispersion
                float normalizedZ = (vPositionZ - interpolationCenter) / zDispersion;

                // Application de la puissance d'interpolation
                // pow() crée des transitions plus ou moins abruptes
                float t = clamp(normalizedZ * 0.5 + 0.5, 0.0, 1.0);
                t = pow(t, interpolationPower);

                // Interpolation linéaire entre colorA et colorB
                // t=0 -> colorA pure (arrière du volume)
                // t=1 -> colorB pure (avant du volume)
                vec3 finalColor = mix(vColorA, vColorB, t);

                // Forme circulaire des particules (antialiasing)
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                float alpha = 1.0 - smoothstep(0.4, 0.5, dist);

                // Couleur finale avec alpha
                gl_FragColor = vec4(finalColor, alpha);

                // Abandon des fragments trop transparents (optimisation)
                if (alpha < 0.01) discard;
            }
        `;
    }

    /**
     * Chargement d'une image et extraction des données pixel
     */
    async loadImage(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    // Création d'un canvas pour lire les pixels
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Redimensionnement forcé en carré (recadrage)
                    const size = Math.min(img.width, img.height);
                    canvas.width = size;
                    canvas.height = size;

                    // Recadrage centré
                    const offsetX = (img.width - size) / 2;
                    const offsetY = (img.height - size) / 2;
                    ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);

                    // Extraction des données pixel
                    const imageData = ctx.getImageData(0, 0, size, size);

                    resolve({
                        image: img,
                        imageData: imageData,
                        resolution: size
                    });
                };
                img.onerror = reject;
                img.src = e.target.result;
            };

            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    }

    /**
     * Génération du système de particules volumétriques
     * Chaque pixel des deux images devient une particule unique
     * portant deux états colorimétriques (colorA, colorB)
     */
    async generateParticleSystem(imageFileA, imageFileB) {
        // Chargement des deux images
        const dataA = await this.loadImage(imageFileA);
        const dataB = await this.loadImage(imageFileB);

        this.imageA = dataA.image;
        this.imageB = dataB.image;
        this.imageDataA = dataA.imageData;
        this.imageDataB = dataB.imageData;

        // Utilisation de la résolution la plus petite
        this.resolution = Math.min(dataA.resolution, dataB.resolution);

        // Calcul du nombre de particules selon la densité
        const step = Math.max(1, Math.floor(10 / this.params.particleDensity));
        const particleCount = Math.floor((this.resolution / step) * (this.resolution / step));

        console.log(`Génération de ${particleCount} particules (résolution: ${this.resolution}, step: ${step})`);

        // Création de la géométrie
        this.geometry = new THREE.BufferGeometry();

        // Tableaux de données pour les attributes
        const positions = new Float32Array(particleCount * 3);
        const colorsA = new Float32Array(particleCount * 3);
        const colorsB = new Float32Array(particleCount * 3);

        let index = 0;

        // Centrage du volume
        const halfRes = this.resolution / 2;

        // Parcours de la grille de pixels avec step adaptatif
        for (let y = 0; y < this.resolution; y += step) {
            for (let x = 0; x < this.resolution; x += step) {
                // Position (x, y) issue de la grille de l'image
                const px = x - halfRes;
                const py = -(y - halfRes); // Inversion Y (Three.js)

                // Position Z : distribution contrôlée dans le volume
                // Utilisation d'une distribution gaussienne pour plus d'organicité
                const pz = this.generateZPosition();

                positions[index * 3] = px;
                positions[index * 3 + 1] = py;
                positions[index * 3 + 2] = pz;

                // Extraction des couleurs des deux images
                const pixelIndex = (y * this.resolution + x) * 4;

                // Couleur A (Image A)
                const rA = this.imageDataA.data[pixelIndex] / 255;
                const gA = this.imageDataA.data[pixelIndex + 1] / 255;
                const bA = this.imageDataA.data[pixelIndex + 2] / 255;

                colorsA[index * 3] = rA;
                colorsA[index * 3 + 1] = gA;
                colorsA[index * 3 + 2] = bA;

                // Couleur B (Image B)
                const rB = this.imageDataB.data[pixelIndex] / 255;
                const gB = this.imageDataB.data[pixelIndex + 1] / 255;
                const bB = this.imageDataB.data[pixelIndex + 2] / 255;

                colorsB[index * 3] = rB;
                colorsB[index * 3 + 1] = gB;
                colorsB[index * 3 + 2] = bB;

                index++;
            }
        }

        // Attribution des BufferAttributes
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('colorA', new THREE.BufferAttribute(colorsA, 3));
        this.geometry.setAttribute('colorB', new THREE.BufferAttribute(colorsB, 3));

        // Création du ShaderMaterial custom
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                pointSize: { value: this.params.pointSize },
                interpolationPower: { value: this.params.interpolationPower },
                interpolationCenter: { value: this.params.interpolationCenter },
                zDispersion: { value: this.params.zDispersion }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        // Suppression de l'ancien système si existant
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
            if (this.geometry) this.geometry.dispose();
            if (this.material) this.material.dispose();
        }

        // Création du système de particules (THREE.Points)
        this.particleSystem = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particleSystem);

        console.log('Système de particules volumétriques généré avec succès');
    }

    /**
     * Génération de la position Z selon une distribution contrôlée
     * Distribution gaussienne pour un effet plus organique
     */
    generateZPosition() {
        // Box-Muller transform pour distribution gaussienne
        const u1 = Math.random();
        const u2 = Math.random();
        const gaussian = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

        // Normalisation et application de la dispersion
        return gaussian * this.params.zDispersion * 0.3;
    }

    /**
     * Mise à jour des paramètres en temps réel
     */
    updateParameter(param, value) {
        this.params[param] = value;

        if (this.material && this.material.uniforms) {
            // Mise à jour des uniforms du shader
            if (param === 'pointSize') {
                this.material.uniforms.pointSize.value = value;
            }
            if (param === 'interpolationPower') {
                this.material.uniforms.interpolationPower.value = value;
            }
            if (param === 'interpolationCenter') {
                this.material.uniforms.interpolationCenter.value = value;
            }
            if (param === 'zDispersion') {
                this.material.uniforms.zDispersion.value = value;
            }
        }

        // Régénération complète pour changement de densité ou dispersion Z
        if ((param === 'particleDensity' || param === 'zDispersion') && this.imageDataA && this.imageDataB) {
            // Conversion des imageData en fichiers simulés pour régénération
            // (nécessite de stocker les fichiers originaux)
            console.log(`Paramètre ${param} modifié, régénération recommandée`);
        }
    }

    /**
     * Animation (rotation automatique)
     */
    update(deltaTime) {
        if (this.particleSystem && this.params.autoRotationSpeed > 0) {
            this.particleSystem.rotation.y += this.params.autoRotationSpeed * deltaTime;
        }
    }

    /**
     * Destruction et nettoyage
     */
    dispose() {
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
        }
        if (this.geometry) {
            this.geometry.dispose();
        }
        if (this.material) {
            this.material.dispose();
        }
    }
}
