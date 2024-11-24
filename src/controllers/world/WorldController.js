import { Color, ColorManagement, DirectionalLight, HemisphereLight, LinearSRGBColorSpace, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Scene, Vector2, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BufferGeometryLoader, EnvironmentTextureLoader, Stage, TextureLoader, getFullscreenTriangle, getViewSize } from '@alienkitty/space.js/three';

import { isOrbit } from '../../config/Config.js';

export class WorldController {
	static init() {
		this.initWorld();
		this.initLights();
		this.initLoaders();
		this.initEnvironment();
		this.initControls();

		this.addListeners();
	}

	static initWorld() {
		this.renderer = new WebGLRenderer({
			powerPreference: 'high-performance'
		});

		// Output canvas
		this.element = this.renderer.domElement;

		// Disable color management
		ColorManagement.enabled = false;
		this.renderer.outputColorSpace = LinearSRGBColorSpace;

		// 3D scene
		this.scene = new Scene();
		this.scene.background = new Color(Stage.rootStyle.getPropertyValue('--bg-color').trim());
		this.camera = new PerspectiveCamera(35);
		this.camera.near = 1;
		this.camera.far = 2000;
		this.camera.position.z = 65;
		this.camera.lookAt(this.scene.position);

		// HUD scene
		this.displayScene = new Scene();
		this.displayCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.displayQuad = new PlaneGeometry(1, 1);
		this.displayQuad.translate(0.5, -0.5, 0);

		// Global geometries
		this.quad = new PlaneGeometry(1, 1);
		this.screenTriangle = getFullscreenTriangle();

		// Global uniforms
		this.resolution = { value: new Vector2() };
		this.texelSize = { value: new Vector2() };
		this.aspect = { value: 1 };
		this.time = { value: 0 };
		this.frame = { value: 0 };

		// Global settings
		this.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
	}

	static initLights() {
		this.scene.add(new HemisphereLight(0x606060, 0x404040, 3));

		const light = new DirectionalLight(0xffffff, 2);
		light.position.set(5, 5, 5);
		this.scene.add(light);

		this.light = light;
	}

	static initLoaders() {
		this.textureLoader = new TextureLoader();
		this.textureLoader.setOptions({
			preserveData: true
		});
		this.textureLoader.cache = true;

		this.environmentLoader = new EnvironmentTextureLoader(this.renderer);
		this.bufferGeometryLoader = new BufferGeometryLoader();
	}

	static async initEnvironment() {
		this.scene.environment = await this.loadEnvironmentTexture('assets/textures/env/jewelry_black_contrast.jpg');
		this.scene.environmentIntensity = 1.2;
	}

	static initControls() {
		if (!isOrbit) {
			return;
		}

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
	}

	static addListeners() {
		this.renderer.domElement.addEventListener('touchstart', this.onTouchStart);
	}

	// Event handlers

	static onTouchStart = e => {
		e.preventDefault();
	};

	// Public methods

	static resize = (width, height, dpr) => {
		width = Math.round(width * dpr);
		height = Math.round(height * dpr);

		this.resolution.value.set(width, height);
		this.texelSize.value.set(1 / width, 1 / height);
		this.aspect.value = width / height;
	};

	static update = (time, delta, frame) => {
		this.time.value = time;
		this.frame.value = frame;

		if (this.controls && this.controls.enabled) {
			this.controls.update();
		}
	};

	static ready = () => Promise.all([
		this.textureLoader.ready(),
		this.environmentLoader.ready()
	]);

	// Global handlers

	static getTexture = (path, callback) => this.textureLoader.load(path, callback);

	static loadTexture = path => this.textureLoader.loadAsync(path);

	static loadEnvironmentTexture = path => this.environmentLoader.loadAsync(path);

	static getBufferGeometry = (path, callback) => this.bufferGeometryLoader.load(path, callback);

	static loadBufferGeometry = path => this.bufferGeometryLoader.loadAsync(path);

	static getViewSize = object => getViewSize(this.camera, object);
}
