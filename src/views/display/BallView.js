import { AmbientLight, DirectionalLight, Group, Mesh, OrthographicCamera, Scene, WebGLRenderTarget } from 'three';
import { clearTween, tween } from '@alienkitty/space.js/three';
import { BasicMaterial } from '@alienkitty/alien.js/three';

import { WorldController } from '../../controllers/world/WorldController.js';
import { Ball } from './Ball.js';

import { breakpoint } from '../../config/Config.js';

export class BallView extends Group {
	constructor() {
		super();

		const size = 20;

		this.width = size;
		this.height = size;

		this.initRenderer();
		// this.initLights(); // Scene lights not needed
		this.initMesh();
		this.initViews();
	}

	initRenderer() {
		const { renderer } = WorldController;

		this.renderer = renderer;

		// Isometric scene
		this.scene = new Scene();
		this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
		// this.camera.position.set(1, 1, 1);
		this.camera.position.set(0, 0, 1);
		this.camera.lookAt(this.scene.position);

		// Zoom to fill frame
		this.camera.zoom = 13;
		this.camera.updateProjectionMatrix();

		// Render targets
		this.renderTarget = new WebGLRenderTarget(1, 1, {
			depthBuffer: false
		});
	}

	initLights() {
		this.scene.add(new AmbientLight(0xffffff, 0.2));

		const light = new DirectionalLight(0xffffff, 2);
		light.position.set(5, 5, 5);
		this.scene.add(light);
	}

	initMesh() {
		const { displayQuad } = WorldController;

		this.material = new BasicMaterial({ map: this.renderTarget.texture });

		this.mesh = new Mesh(displayQuad, this.material);
		this.mesh.frustumCulled = false;
		this.mesh.scale.set(this.width, this.height, 1);

		this.add(this.mesh);
	}

	initViews() {
		this.ball = new Ball();
		this.scene.add(this.ball);
	}

	// Public methods

	setColor = color => {
		this.ball.setColor(color);
		this.update();
	};

	resize = (width, height, dpr) => {
		if (width < breakpoint) {
			this.x = 20;
			this.y = 18;
		} else {
			this.x = 30;
			this.y = 28;
		}

		this.position.x = this.x;
		this.position.y = -this.y; // Y inverted

		width = Math.round(this.width * dpr);
		height = Math.round(this.height * dpr);

		this.renderTarget.setSize(width, height);

		this.update();
	};

	update = () => {
		const currentRenderTarget = this.renderer.getRenderTarget();

		// Scene pass
		this.renderer.setRenderTarget(this.renderTarget);
		this.renderer.clear();
		this.renderer.render(this.scene, this.camera);

		// Restore renderer settings
		this.renderer.setRenderTarget(currentRenderTarget);
	};

	animateIn = () => {
		const duration = 1000;
		const ease = 'easeOutQuart';
		const delay = 200;

		clearTween(this.position);
		clearTween(this.material.uniforms.uAlpha);

		this.position.x = this.x - 10;
		this.material.uniforms.uAlpha.value = 0;

		tween(this.position, { x: this.x }, duration, ease, delay);
		tween(this.material.uniforms.uAlpha, { value: 1 }, duration, ease, delay);
	};

	animateOut() {
		clearTween(this.position);
		clearTween(this.material.uniforms.uAlpha);

		tween(this.material.uniforms.uAlpha, { value: 0 }, 400, 'easeOutCubic');
	}

	toggle = show => {
		if (show) {
			this.animateIn();
		} else {
			this.animateOut();
		}
	};
}
