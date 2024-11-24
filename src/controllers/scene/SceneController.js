import { Vector2, Vector3 } from 'three';

import { WorldController } from '../world/WorldController.js';
import { ScenePhysicsController } from './ScenePhysicsController.js';

import { isMobile } from '../../config/Config.js';

export class SceneController {
	static init(camera, view, trackers, ui) {
		this.camera = camera;
		this.view = view;
		this.trackers = trackers;
		this.ui = ui;

		this.mouse = new Vector2();
		this.lightPosition = new Vector3();
		this.mobileOffset = new Vector3(0, isMobile ? 6 : 0, 0); // Position above finger
		this.isDown = false;

		this.initPhysics();

		this.addListeners();
	}

	static initPhysics() {
		this.physics = new ScenePhysicsController(this.camera, this.view, this.trackers, this.ui);
	}

	static addListeners() {
		window.addEventListener('pointerdown', this.onPointerDown);
		window.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
	}

	// Event handlers

	static onPointerDown = e => {
		if (!this.view.visible) {
			return;
		}

		this.isDown = true;

		this.onPointerMove(e);
	};

	static onPointerMove = ({ clientX, clientY }) => {
		if (!this.view.visible) {
			return;
		}

		this.mouse.x = (clientX / document.documentElement.clientWidth) * 2 - 1;
		this.mouse.y = 1 - (clientY / document.documentElement.clientHeight) * 2;
	};

	static onPointerUp = e => {
		if (!this.view.visible) {
			return;
		}

		this.isDown = false;

		this.onPointerMove(e);
	};

	// Public methods

	static resize = (width, height) => {
		const { getViewSize } = WorldController;

		const { x, y } = getViewSize();

		this.halfWidth = x / 2;
		this.halfHeight = y / 2;

		this.physics.resize(width, height);
	};

	static update = time => {
		if (!this.view.visible) {
			return;
		}

		this.lightPosition.x = this.mouse.x * this.halfWidth;
		this.lightPosition.y = this.mouse.y * this.halfHeight;

		this.lightPosition.add(this.mobileOffset);

		if (!this.physics.animatedIn) {
			this.physics.point.copy(this.lightPosition);
		} else {
			this.physics.motion({
				isDown: this.isDown,
				x: this.lightPosition.x,
				y: this.lightPosition.y,
				z: this.lightPosition.z
			});
		}

		this.physics.update(time);
	};

	static start = () => {
		this.physics.start();
		this.view.animateIn();
	};

	static animateIn = () => {
		this.physics.animateIn();
	};

	static ready = async () => {
		await this.view.ready();
		await this.physics.ready();
	};
}
