/**
 * main.js
 * =======
 * Orchestration du système de visualisation volumétrique
 * Gestion de l'interface, des contrôles et de la scène Three.js
 */

// Variables globales
let scene, camera, renderer, controls;
let volumetricParticles;
let clock;
let currentImageA = null;
let currentImageB = null;

// Éléments DOM
const dropZone = document.getElementById('drop-zone');
const slotA = document.getElementById('slot-a');
const slotB = document.getElementById('slot-b');
const previewA = document.getElementById('preview-a');
const previewB = document.getElementById('preview-b');
const controlsPanel = document.getElementById('controls-panel');
const instructions = document.getElementById('instructions');

/**
 * Initialisation de la scène Three.js
 */
function initThreeJS() {
    // Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Caméra
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000);
    camera.position.z = 600;
    camera.position.y = 0;
    camera.position.x = 0;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const container = document.getElementById('canvas-container');
    container.appendChild(renderer.domElement);

    // Contrôles OrbitControls (manipulation 360°)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.2;
    controls.enablePan = true;

    // Clock pour animation
    clock = new THREE.Clock();

    // Instance du système de particules volumétriques
    volumetricParticles = new VolumetricParticles(scene);

    console.log('Scène Three.js initialisée');
}

/**
 * OrbitControls inline (THREE.OrbitControls)
 * Version simplifiée pour manipulation caméra
 */
THREE.OrbitControls = function(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.enabled = true;
    this.enableDamping = false;
    this.dampingFactor = 0.05;
    this.rotateSpeed = 1.0;
    this.zoomSpeed = 1.0;
    this.enablePan = true;

    const scope = this;
    const STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
    let state = STATE.NONE;

    const spherical = new THREE.Spherical();
    const sphericalDelta = new THREE.Spherical();
    let scale = 1;
    const panOffset = new THREE.Vector3();

    const rotateStart = new THREE.Vector2();
    const rotateEnd = new THREE.Vector2();
    const rotateDelta = new THREE.Vector2();

    const panStart = new THREE.Vector2();
    const panEnd = new THREE.Vector2();
    const panDelta = new THREE.Vector2();

    const zoomStart = new THREE.Vector2();
    const zoomEnd = new THREE.Vector2();
    const zoomDelta = new THREE.Vector2();

    const target = new THREE.Vector3();

    function getAutoRotationAngle() {
        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
    }

    function getZoomScale() {
        return Math.pow(0.95, scope.zoomSpeed);
    }

    function rotateLeft(angle) {
        sphericalDelta.theta -= angle;
    }

    function rotateUp(angle) {
        sphericalDelta.phi -= angle;
    }

    function panLeft(distance, objectMatrix) {
        const v = new THREE.Vector3();
        v.setFromMatrixColumn(objectMatrix, 0);
        v.multiplyScalar(-distance);
        panOffset.add(v);
    }

    function panUp(distance, objectMatrix) {
        const v = new THREE.Vector3();
        v.setFromMatrixColumn(objectMatrix, 1);
        v.multiplyScalar(distance);
        panOffset.add(v);
    }

    function pan(deltaX, deltaY) {
        const offset = new THREE.Vector3();
        const element = scope.domElement;

        offset.copy(scope.camera.position).sub(target);
        let targetDistance = offset.length();
        targetDistance *= Math.tan((scope.camera.fov / 2) * Math.PI / 180.0);

        panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.camera.matrix);
        panUp(2 * deltaY * targetDistance / element.clientHeight, scope.camera.matrix);
    }

    function dollyIn(dollyScale) {
        scale /= dollyScale;
    }

    function dollyOut(dollyScale) {
        scale *= dollyScale;
    }

    function onMouseDown(event) {
        if (!scope.enabled) return;

        event.preventDefault();

        if (event.button === 0) {
            state = STATE.ROTATE;
            rotateStart.set(event.clientX, event.clientY);
        } else if (event.button === 1) {
            state = STATE.ZOOM;
            zoomStart.set(event.clientX, event.clientY);
        } else if (event.button === 2) {
            state = STATE.PAN;
            panStart.set(event.clientX, event.clientY);
        }

        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);
    }

    function onMouseMove(event) {
        if (!scope.enabled) return;

        event.preventDefault();

        if (state === STATE.ROTATE) {
            rotateEnd.set(event.clientX, event.clientY);
            rotateDelta.subVectors(rotateEnd, rotateStart);

            const element = scope.domElement;
            rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight * scope.rotateSpeed);
            rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * scope.rotateSpeed);

            rotateStart.copy(rotateEnd);
            scope.update();
        } else if (state === STATE.ZOOM) {
            zoomEnd.set(event.clientX, event.clientY);
            zoomDelta.subVectors(zoomEnd, zoomStart);

            if (zoomDelta.y > 0) {
                dollyIn(getZoomScale());
            } else if (zoomDelta.y < 0) {
                dollyOut(getZoomScale());
            }

            zoomStart.copy(zoomEnd);
            scope.update();
        } else if (state === STATE.PAN) {
            panEnd.set(event.clientX, event.clientY);
            panDelta.subVectors(panEnd, panStart);
            pan(panDelta.x, panDelta.y);
            panStart.copy(panEnd);
            scope.update();
        }
    }

    function onMouseUp() {
        if (!scope.enabled) return;
        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);
        state = STATE.NONE;
    }

    function onMouseWheel(event) {
        if (!scope.enabled) return;

        event.preventDefault();
        event.stopPropagation();

        if (event.deltaY < 0) {
            dollyOut(getZoomScale());
        } else if (event.deltaY > 0) {
            dollyIn(getZoomScale());
        }

        scope.update();
    }

    this.update = function() {
        const offset = new THREE.Vector3();
        const quat = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
        const quatInverse = quat.clone().invert();

        const position = scope.camera.position;

        offset.copy(position).sub(target);
        offset.applyQuaternion(quat);

        spherical.setFromVector3(offset);
        spherical.theta += sphericalDelta.theta;
        spherical.phi += sphericalDelta.phi;
        spherical.phi = Math.max(0.000001, Math.min(Math.PI - 0.000001, spherical.phi));
        spherical.radius *= scale;

        offset.setFromSpherical(spherical);
        offset.applyQuaternion(quatInverse);

        position.copy(target).add(offset);
        scope.camera.lookAt(target);

        if (scope.enableDamping) {
            sphericalDelta.theta *= (1 - scope.dampingFactor);
            sphericalDelta.phi *= (1 - scope.dampingFactor);
        } else {
            sphericalDelta.set(0, 0, 0);
        }

        scale = 1;
        panOffset.set(0, 0, 0);
    };

    this.dispose = function() {
        scope.domElement.removeEventListener('mousedown', onMouseDown, false);
        scope.domElement.removeEventListener('wheel', onMouseWheel, false);
        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);
    };

    scope.domElement.addEventListener('mousedown', onMouseDown, false);
    scope.domElement.addEventListener('wheel', onMouseWheel, false);
    scope.domElement.addEventListener('contextmenu', (e) => e.preventDefault(), false);
};

/**
 * Système de drag & drop
 */
function initDragAndDrop() {
    // Prévention du comportement par défaut
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight lors du drag
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragging');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragging');
        });
    });

    // Gestion du drop
    dropZone.addEventListener('drop', handleDrop);

    // Click sur les slots individuels
    slotA.addEventListener('click', () => triggerFileInput('A'));
    slotB.addEventListener('click', () => triggerFileInput('B'));
}

function handleDrop(e) {
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length >= 1) {
        if (!currentImageA) {
            loadImageToSlot(imageFiles[0], 'A');
            if (imageFiles[1]) {
                loadImageToSlot(imageFiles[1], 'B');
            }
        } else if (!currentImageB) {
            loadImageToSlot(imageFiles[0], 'B');
        } else {
            // Remplacement : première image -> A, deuxième -> B
            loadImageToSlot(imageFiles[0], 'A');
            if (imageFiles[1]) {
                loadImageToSlot(imageFiles[1], 'B');
            }
        }
    }
}

function triggerFileInput(slot) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            loadImageToSlot(file, slot);
        }
    };
    input.click();
}

function loadImageToSlot(file, slot) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            if (slot === 'A') {
                currentImageA = file;
                previewA.innerHTML = `<img src="${e.target.result}" alt="Image A">`;
                previewA.classList.add('has-image');
                slotA.classList.add('filled');
            } else {
                currentImageB = file;
                previewB.innerHTML = `<img src="${e.target.result}" alt="Image B">`;
                previewB.classList.add('has-image');
                slotB.classList.add('filled');
            }

            // Si les deux images sont chargées, générer le système
            if (currentImageA && currentImageB) {
                generateVolumetricSystem();
            }
        };
        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

async function generateVolumetricSystem() {
    console.log('Génération du système volumétrique...');

    try {
        await volumetricParticles.generateParticleSystem(currentImageA, currentImageB);

        // Masquer la zone de drop
        dropZone.classList.add('hidden');
        instructions.classList.add('hidden');

        // Afficher les contrôles
        controlsPanel.classList.remove('hidden');

        console.log('Système volumétrique généré avec succès');
    } catch (error) {
        console.error('Erreur lors de la génération:', error);
        alert('Erreur lors de la génération du système volumétrique');
    }
}

/**
 * Initialisation des contrôles UI
 */
function initControls() {
    // Densité de particules
    const densitySlider = document.getElementById('particle-density');
    const densityValue = document.getElementById('density-value');
    densitySlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        densityValue.textContent = value;
        volumetricParticles.updateParameter('particleDensity', value);
    });

    // Dispersion Z
    const dispersionSlider = document.getElementById('z-dispersion');
    const dispersionValue = document.getElementById('dispersion-value');
    dispersionSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        dispersionValue.textContent = value;
        volumetricParticles.updateParameter('zDispersion', value);
    });

    // Taille des points
    const sizeSlider = document.getElementById('point-size');
    const sizeValue = document.getElementById('size-value');
    sizeSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        sizeValue.textContent = value.toFixed(1);
        volumetricParticles.updateParameter('pointSize', value);
    });

    // Intensité d'interpolation
    const interpolationSlider = document.getElementById('interpolation-power');
    const interpolationValue = document.getElementById('interpolation-value');
    interpolationSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        interpolationValue.textContent = value.toFixed(1);
        volumetricParticles.updateParameter('interpolationPower', value);
    });

    // Centre d'interpolation
    const centerSlider = document.getElementById('interpolation-center');
    const centerValue = document.getElementById('center-value');
    centerSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        centerValue.textContent = value;
        volumetricParticles.updateParameter('interpolationCenter', value);
    });

    // Rotation automatique
    const rotationSlider = document.getElementById('rotation-speed');
    const rotationValue = document.getElementById('rotation-value');
    rotationSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        rotationValue.textContent = value.toFixed(1);
        volumetricParticles.updateParameter('autoRotationSpeed', value);
    });

    // Bouton reset
    const resetButton = document.getElementById('reset-button');
    resetButton.addEventListener('click', () => {
        resetSystem();
    });
}

function resetSystem() {
    // Réinitialisation
    currentImageA = null;
    currentImageB = null;

    previewA.innerHTML = '';
    previewB.innerHTML = '';
    previewA.classList.remove('has-image');
    previewB.classList.remove('has-image');
    slotA.classList.remove('filled');
    slotB.classList.remove('filled');

    volumetricParticles.dispose();

    dropZone.classList.remove('hidden');
    controlsPanel.classList.add('hidden');
    instructions.classList.remove('hidden');
}

/**
 * Boucle d'animation
 */
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Mise à jour des contrôles
    if (controls) {
        controls.update();
    }

    // Mise à jour du système de particules
    if (volumetricParticles) {
        volumetricParticles.update(deltaTime);
    }

    // Rendu
    renderer.render(scene, camera);
}

/**
 * Gestion du redimensionnement
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

/**
 * Initialisation au chargement
 */
window.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initDragAndDrop();
    initControls();
    animate();

    console.log('Système de visualisation volumétrique initialisé');
    console.log('Glissez deux images pour commencer');
});
