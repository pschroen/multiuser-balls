import { Interface, Stage, clearTween, delayedCall } from '@alienkitty/space.js/three';

export class TrackersView extends Interface {
	constructor() {
		super('.trackers');

		this.init();

		this.addListeners();
	}

	init() {
		this.hide();
		this.css({
			position: 'fixed',
			left: 0,
			top: 0,
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
			webkitUserSelect: 'none',
			userSelect: 'none',
			opacity: 0
		});
	}

	addListeners() {
		Stage.events.on('tracker', this.onTracker);
	}

	// Event handlers

	onTracker = ({ select }) => {
		clearTween(this.timeout);

		if (select) {
			this.children.filter(child => child.id !== select).forEach(child => child.deactivate());
			this.children.filter(child => child.id === select).forEach(child => child.activate());
		} else {
			this.timeout = delayedCall(200, () => {
				this.children.forEach(child => child.activate());
			});
		}
	};

	// Public methods

	animateIn = () => {
		this.show();
		this.clearTween().tween({ opacity: 1 }, 2000, 'easeOutSine');
	};

	animateOut = () => {
		this.clearTween().tween({ opacity: 0 }, 400, 'easeOutCubic', () => {
			this.hide();
		});
	};
}
