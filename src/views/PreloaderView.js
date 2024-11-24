import { Input, Interface, Panel, PanelItem, Stage, clearTween, delayedCall, tween } from '@alienkitty/space.js/three';

import { breakpoint, isMobile, lightColor, store } from '../config/Config.js';
import { formatColor } from '../utils/Utils.js';

export class PreloaderView extends Interface {
	constructor() {
		super('.preloader');

		this.progress = 0;

		this.init();

		this.addListeners();
		this.onResize();
	}

	init() {
		this.css({
			position: 'fixed',
			left: 0,
			top: 0,
			width: '100%',
			height: '100%',
			zIndex: 1,
			pointerEvents: 'none'
		});

		this.bg = new Interface('.bg');
		this.bg.css({
			position: 'absolute',
			width: '100%',
			height: '100%',
			backgroundColor: 'var(--bg-color)'
		});
		this.add(this.bg);

		this.container = new Interface('.container');
		this.container.css({
			position: 'absolute',
			left: '50%',
			top: '50%',
			width: 'var(--ui-panel-width)',
			height: 74,
			marginLeft: 'calc(var(--ui-panel-width) / -2)',
			marginTop: -108
		});
		this.add(this.container);

		this.panel = new Panel();
		this.container.add(this.panel);

		const item = new PanelItem({
			type: 'color',
			value: lightColor,
			noText: true,
			callback: this.onPicking
		});
		this.panel.add(item);

		this.colorPicker = item.view;

		this.color = new Input({
			placeholder: store.placeholder,
			maxlength: 6,
			noTotal: true,
			noLine: true
		});
		this.color.css({
			position: 'absolute',
			top: 0,
			right: 0,
			width: 47,
			height: 19
		});
		this.container.add(this.color);

		this.number = new Interface('.number');
		this.number.css({
			position: 'relative',
			left: '50%',
			width: 150,
			height: 25,
			marginLeft: -150 / 2,
			webkitUserSelect: 'none',
			userSelect: 'none'
		});
		this.container.add(this.number);

		this.number.info = new Interface('.info', 'h2');
		this.number.info.css({
			position: 'absolute',
			width: '100%',
			fontVariantNumeric: 'tabular-nums',
			textAlign: 'center',
			whiteSpace: 'nowrap'
		});
		this.number.info.text(0);
		this.number.add(this.number.info);

		this.title = new Interface('.title');
		this.title.css({
			position: 'relative',
			left: '50%',
			width: 600,
			height: 25,
			marginLeft: -600 / 2,
			webkitUserSelect: 'none',
			userSelect: 'none',
			opacity: 0
		});
		this.container.add(this.title);

		this.title.info = new Interface('.info', 'h2');
		this.title.info.css({
			position: 'absolute',
			width: '100%',
			textAlign: 'center',
			whiteSpace: 'nowrap'
		});
		this.title.info.text(isMobile ? 'Put on your headphones' : 'Turn up your speakers');
		this.title.add(this.title.info);
	}

	addStartButton() {
		this.number.tween({ opacity: 0 }, 200, 'easeOutSine', () => {
			this.number.hide();
			this.title.css({ y: 10, opacity: 0 }).tween({ y: 0, opacity: 1 }, 1000, 'easeOutQuart', 100);

			this.timeout1 = delayedCall(7000, () => this.swapTitle((isMobile ? 'Tap' : 'Click') + ' anywhere'));
			this.timeout2 = delayedCall(14000, () => this.swapTitle(isMobile ? 'Tap tap!' : 'Click!'));
		});
	}

	swapTitle(text) {
		this.title.tween({ y: -10, opacity: 0 }, 300, 'easeInSine', () => {
			if (!this.title) {
				return;
			}

			this.title.info.text(text);
			this.title.css({ y: 10 }).tween({ y: 0, opacity: 1 }, 1000, 'easeOutCubic');
		});
	}

	addListeners() {
		window.addEventListener('resize', this.onResize);
		this.bg.element.addEventListener('pointerdown', this.onPointerDown);
		this.color.events.on('update', this.onUpdate);
		this.color.events.on('complete', this.onComplete);
	}

	removeListeners() {
		window.removeEventListener('resize', this.onResize);
		this.bg.element.removeEventListener('pointerdown', this.onPointerDown);
		this.color.events.off('update', this.onUpdate);
		this.color.events.off('complete', this.onComplete);
	}

	// Event handlers

	onResize = () => {
		if (document.documentElement.clientWidth < document.documentElement.clientHeight) {
			this.container.css({ marginTop: -108 });
		} else if (document.documentElement.clientWidth < breakpoint) {
			this.container.css({ marginTop: -74 / 2 });
		} else {
			this.container.css({ marginTop: -108 });
		}
	};

	onPointerDown = () => {
		this.events.emit('start');
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

			Stage.events.emit('color', { value: store.color });
		});
	};

	onPicking = value => {
		if (value.getHex() === lightColor) {
			return;
		}

		store.color = value.getHexString();

		this.color.setValue(store.color);

		clearTween(this.timeout);

		this.timeout = delayedCall(200, () => {
			Stage.events.emit('color', { value: store.color });
		});
	};

	onComplete = () => {
		if (!this.isComplete) {
			return;
		}

		this.events.emit('start');
	};

	onProgress = ({ progress }) => {
		clearTween(this);

		tween(this, { progress }, 2000, 'easeInOutSine', null, () => {
			this.number.info.text(Math.round(100 * this.progress));

			if (this.progress === 1 && !this.isComplete) {
				this.isComplete = true;

				this.events.emit('complete');

				if (this.color.isComplete) {
					this.events.emit('start');
				} else {
					this.bg.css({ pointerEvents: 'auto' });
					this.bg.tween({ opacity: 0 }, 2000, 'easeOutSine');

					this.addStartButton();
				}
			}
		});
	};

	// Public methods

	animateIn = async () => {
		this.panel.animateIn(true);
		await this.color.animateIn();
		this.color.focus();
	};

	animateOut = () => {
		this.number.clearTween().tween({ opacity: 0 }, 200, 'easeOutSine');
		this.title.clearTween().tween({ opacity: 0 }, 200, 'easeOutSine');
		return this.tween({ opacity: 0 }, 600, 'easeInOutSine');
	};

	destroy = () => {
		this.removeListeners();

		clearTween(this.timeout1);
		clearTween(this.timeout2);

		return super.destroy();
	};
}
