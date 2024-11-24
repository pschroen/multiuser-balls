import { Vector2 } from 'three';
import { Input, Interface, Panel, PanelItem, Stage, clearTween, delayedCall } from '@alienkitty/space.js/three';

import { lightColor, store } from '../../config/Config.js';
import { formatColor } from '../../utils/Utils.js';

export class HeaderColor extends Interface {
	constructor(display) {
		super('.color');

		this.display = display;

		this.mouse = new Vector2();
		this.delta = new Vector2();
		this.lastTime = null;
		this.lastMouse = new Vector2();
		this.openColor = null;

		this.init();

		this.addListeners();
	}

	init() {
		this.css({
			position: 'relative',
			cssFloat: 'left',
			width: 128,
			height: 35
		});

		this.latency = new Interface('.secondary');
		this.latency.css({
			position: 'absolute',
			left: 34,
			top: 10,
			fontSize: 'var(--ui-secondary-font-size)',
			letterSpacing: 'var(--ui-secondary-letter-spacing)',
			color: 'var(--ui-secondary-color)',
			webkitUserSelect: 'none',
			userSelect: 'none'
		});
		this.add(this.latency);

		this.panel = new Panel();
		this.panel.css({
			position: 'absolute',
			left: 10,
			top: 8,
			width: 108
		});
		this.add(this.panel);

		const item = new PanelItem({
			type: 'color',
			value: lightColor,
			noText: true,
			callback: this.onPicking
		});
		this.panel.add(item);

		this.colorPicker = item.view;
		this.colorPicker.fastClose = false;
		this.colorPicker.swatch.invisible();

		this.color = new Input({
			placeholder: store.placeholder,
			maxlength: 6,
			noTotal: true,
			noLine: true
		});
		this.color.css({
			position: 'absolute',
			top: 8,
			right: 10,
			width: 47,
			height: 19
		});
		this.add(this.color);
	}

	addListeners() {
		Stage.events.on('color_picker', this.onColorPicker);
		this.color.events.on('update', this.onUpdate);
		this.color.events.on('complete', this.onComplete);
		window.addEventListener('pointerdown', this.onPointerDown);
	}

	removeListeners() {
		Stage.events.off('color_picker', this.onColorPicker);
		this.color.events.off('update', this.onUpdate);
		this.color.events.off('complete', this.onComplete);
		window.removeEventListener('pointerdown', this.onPointerDown);
	}

	// Event handlers

	onColorPicker = ({ open, target }) => {
		if (!this.openColor && !this.element.contains(target.element)) {
			return;
		}

		if (open) {
			this.openColor = target;
		} else {
			this.openColor = null;
		}
	};

	onUpdate = ({ value }) => {
		clearTween(this.timeout);

		const style = formatColor(value);

		this.timeout = delayedCall(200, () => {
			if (style) {
				this.colorPicker.setValue(style, false);

				store.color = this.colorPicker.value.getHexString();
			} else {
				this.colorPicker.setValue(lightColor, false);

				store.color = '';
			}

			this.display.ball.setColor(this.colorPicker.value);

			Stage.events.emit('color', { value: store.color });
		});
	};

	onPicking = value => {
		if (value.getHex() === lightColor) {
			return;
		}

		this.display.ball.setColor(value);

		store.color = value.getHexString();

		this.color.setValue(store.color);

		clearTween(this.timeout);

		this.timeout = delayedCall(200, () => {
			Stage.events.emit('color', { value: store.color });
		});
	};

	onComplete = () => {
		this.color.blur();

		Stage.events.emit('color_picker', { open: false, target: this });
	};

	onPointerDown = e => {
		if (!this.openColor) {
			return;
		}

		this.lastTime = performance.now();
		this.lastMouse.set(e.clientX, e.clientY);

		this.onPointerMove(e);

		window.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
	};

	onPointerMove = ({ clientX, clientY }) => {
		const event = {
			x: clientX,
			y: clientY
		};

		this.mouse.copy(event);
		this.delta.subVectors(this.mouse, this.lastMouse);
	};

	onPointerUp = e => {
		window.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);

		if (performance.now() - this.lastTime > 250 || this.delta.length() > 50) {
			return;
		}

		if (this.openColor && !this.openColor.element.contains(e.target)) {
			Stage.events.emit('color_picker', { open: false, target: this });
		}
	};

	// Public methods

	setData = data => {
		if (!data) {
			return;
		}

		if (data.latency) {
			this.latency.text(`${data.latency}ms`);
		}
	};

	animateIn = () => {
		if (store.color) {
			const style = `#${store.color}`;

			this.colorPicker.setValue(style, false);
			this.display.ball.setColor(this.colorPicker.value);
			this.color.setValue(store.color);
		}

		this.panel.animateIn();
		this.color.animateIn();
	};

	destroy = () => {
		this.removeListeners();

		return super.destroy();
	};
}
