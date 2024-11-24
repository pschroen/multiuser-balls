import { Group } from 'three';

import { BallView } from './display/BallView.js';

export class DisplayView extends Group {
	constructor() {
		super();

		this.visible = false;

		this.initViews();
	}

	initViews() {
		this.ball = new BallView();
		this.add(this.ball);
	}

	// Public methods

	resize = (width, height, dpr) => {
		this.ball.resize(width, height, dpr);
	};

	update = () => {
	};

	animateIn = () => {
		this.ball.animateIn();

		this.visible = true;
	};

	toggle = show => {
		this.ball.toggle(show);
	};

	ready = () => Promise.all([
	]);
}
