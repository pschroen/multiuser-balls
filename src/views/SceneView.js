import { Group } from 'three';

import { InstancedBalls } from './scene/InstancedBalls.js';
import { InstancedBall } from './scene/InstancedBall.js';

export class SceneView extends Group {
	constructor() {
		super();

		this.visible = false;

		this.initViews();
	}

	initViews() {
		this.balls = new InstancedBalls();
		this.add(this.balls);

		this.ball = new InstancedBall();
		this.add(this.ball);
	}

	// Public methods

	animateIn = () => {
		this.visible = true;
	};

	ready = () => Promise.all([
		this.balls.ready(),
		this.ball.ready()
	]);
}
