import { Matrix4, Object3D } from 'three';
import { Sound3D, WebAudio, clamp, delayedCall, smootherstep, tween } from '@alienkitty/space.js/three';

import { store } from '../../config/Config.js';

export class AudioController {
	static init(camera, view, ui) {
		this.camera = camera;
		this.view = view;
		this.ui = ui;

		if (!store.sound) {
			WebAudio.mute(true);
		}

		this.object = new Object3D();
		this.matrix = new Matrix4();

		this.addListeners();
	}

	static addListeners() {
		document.addEventListener('visibilitychange', this.onVisibility);
		window.addEventListener('beforeunload', this.onBeforeUnload);
	}

	// Event handlers

	static onVisibility = () => {
		if (!store.sound) {
			return;
		}

		if (document.hidden) {
			WebAudio.mute();
		} else {
			WebAudio.unmute();
		}
	};

	static onBeforeUnload = () => {
		WebAudio.mute();
	};

	// Public methods

	static trigger = (event, body, force) => {
		switch (event) {
			case 'flam': {
				this.view.balls.mesh.getMatrixAt(body, this.matrix);
				this.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);

				const flam = new Sound3D(this.camera, 'flam');
				flam.position.copy(this.object.position);
				flam.quaternion.copy(this.object.quaternion);
				flam.updateMatrixWorld();

				const strength = clamp(smootherstep(force, -1, 12), 0, 1);
				if (strength === 1) console.log('flam', force, strength);
				flam.sound.gain.set(strength * 0.7);
				flam.sound.playbackRate.set(clamp(0.8 + strength * 0.4, 0.8, 1.2));
				flam.sound.play();

				delayedCall(6000, () => {
					flam.destroy();
				});
				break;
			}
			case 'wet': {
				WebAudio.play('wet', 0.1);
				break;
			}
			case 'balls_start':
				WebAudio.fadeInAndPlay('enough_loop', 0.05, true, 2000, 'linear');
				break;
			case 'about_section':
				tween(WebAudio.gain, { value: 0.3 }, 1000, 'easeOutSine');
				break;
			case 'balls_section':
				tween(WebAudio.gain, { value: 1 }, 1000, 'easeOutSine');
				break;
			case 'sound_off':
				tween(WebAudio.gain, { value: 0 }, 500, 'easeOutSine');
				break;
			case 'sound_on':
				tween(WebAudio.gain, { value: this.ui.isDetailsOpen ? 0.3 : 1 }, 500, 'easeOutSine');
				break;
		}
	};

	static start = () => {
		this.trigger('balls_start');
		this.trigger('wet');
	};

	static mute = () => {
		this.trigger('sound_off');
	};

	static unmute = () => {
		this.trigger('sound_on');
	};
}
