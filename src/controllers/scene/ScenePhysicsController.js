import { Color, Vector2, Vector3 } from 'three';
import { Reticle, Stage, Thread, clamp, delayedCall, tween } from '@alienkitty/space.js/three';
import { Wobble } from '@alienkitty/alien.js/three';
import { OimoPhysicsController } from '@alienkitty/alien.js/three/oimophysics';

import { Data } from '../../data/Data.js';
import { Socket } from '../../data/Socket.js';
import { SocketThread } from '../../data/SocketThread.js';
import { AudioController } from '../audio/AudioController.js';
import { DetailsUser } from '../../views/ui/DetailsUser.js';

import { breakpoint, lightColor, numPointers, store } from '../../config/Config.js';
import { formatColor, nearEqualsRGB } from '../../utils/Utils.js';

export class ScenePhysicsController extends OimoPhysicsController {
	constructor(camera, view, trackers, ui) {
		super();

		this.camera = camera;
		this.view = view;
		this.trackers = trackers;
		this.ui = ui;

		this.id = null;
		this.array = null;
		this.buffer = [];
		this.pointer = {};
		this.lerpSpeed = 0.07;
		this.progress = 0;
		this.connected = false;
		this.enabled = false;
		this.animatedIn = false;

		// Start position
		this.position = new Vector3();
		this.point = new Vector3();

		this.wobble = new Wobble(this.position);
		this.wobble.scale = 3;
		this.wobble.lerpSpeed = 0.01;

		this.halfScreen = new Vector2();
		this.screenSpacePosition = new Vector3();

		this.last = performance.now();
		this.time = 0;
		this.delta = 0;
		this.count = 0;
		this.prev = 0;
		this.fps = 0;

		this.promise = new Promise(resolve => this.resolve = resolve);
	}

	init() {
		this.initShapes();
		this.initSocket();

		this.addListeners();
	}

	initShapes() {
		const { balls, ball } = this.view;

		this.add(balls.mesh, {
			name: 'balls',
			density: 1,
			autoSleep: false
		});

		this.add(ball.mesh, {
			name: 'mouse'
		});

		// console.log('initShapes', JSON.stringify(this.shapes));
	}

	initSocket() {
		const port = Number(location.port) > 1000 ? `:${location.port}` : '';
		const protocol = location.protocol.replace('http', 'ws');
		const server = `${protocol}//${location.hostname}${port}/${location.search}`;
		// const server = 'wss://multiuser-balls.glitch.me';

		this.thread = new Thread({
			imports: [
				// Make sure to export these from App.js
				[import.meta.url, 'EventEmitter']
			],
			classes: [Socket],
			controller: [SocketThread, 'init', 'color', 'motion']
		});

		// this.thread.init({ shapes: this.shapes });
		this.thread.init({ server });
	}

	addListeners() {
		Stage.events.on('color', this.onColor);
		document.addEventListener('visibilitychange', this.onVisibility);

		this.thread.on('close', this.onClose);
		this.thread.on('users', this.onUsers);
		this.thread.on('heartbeat', this.onHeartbeat);
		this.thread.on('buffer', this.onBuffer);
		this.thread.on('contact', this.onContact);
	}

	// Event handlers

	onColor = ({ value }) => {
		if (!this.id || !this.pointer[this.id]) {
			return;
		}

		const id = this.id;
		const style = formatColor(value);

		this.pointer[id].target.set(style || lightColor);
		this.pointer[id].last.copy(this.pointer[id].target);
		this.pointer[id].needsUpdate = true;

		this.color(value);
	};

	onVisibility = () => {
		this.enabled = !document.hidden;
	};

	onClose = () => {
		this.connected = false;
	};

	onUsers = ({ users }) => {
		store.users = users;

		Stage.events.emit('update', users);

		if (!this.id) {
			return;
		}

		const ids = users.map(user => user.id);

		// New
		ids.forEach(id => {
			if (id === this.id) {
				return;
			}

			const i = Number(id);

			if (i !== numPointers && !this.pointer[id]) {
				this.pointer[id] = {};
				this.pointer[id].needsUpdate = false;
				this.pointer[id].color = new Color();
				this.pointer[id].last = new Color();
				this.pointer[id].target = new Color();
				this.pointer[id].target.set(lightColor);
				this.pointer[id].color.copy(this.pointer[id].target);
				this.pointer[id].last.copy(this.pointer[id].color);

				this.pointer[id].tracker = this.trackers.add(new Reticle());
				this.pointer[id].tracker.id = id;

				this.pointer[id].info = this.ui.detailsUsers.add(new DetailsUser());

				if (this.ui.isDetailsOpen) {
					this.pointer[id].info.enable();
					this.pointer[id].info.animateIn();
				}

				this.view.ball.color.copy(this.pointer[id].color);
				this.view.ball.lights[i].color.copy(this.pointer[id].color);
				this.view.ball.mesh.setColorAt(i, this.view.ball.color);
				this.view.ball.mesh.instanceColor.needsUpdate = true;
			}
		});

		// Update and prune
		Object.keys(this.pointer).forEach(id => {
			if (id === this.id) {
				this.ui.header.color.setData(Data.getUser(id));
				this.pointer[id].info.setData(Data.getUserData(id));
				return;
			}

			if (ids.includes(id)) {
				this.pointer[id].tracker.setData(Data.getReticleData(id));
				this.pointer[id].info.setData(Data.getUserData(id));

				const data = Data.getUser(id);
				const style = formatColor(data.color);

				this.pointer[id].target.set(style || lightColor);

				if (!this.pointer[id].target.equals(this.pointer[id].last)) {
					this.pointer[id].last.copy(this.pointer[id].target);
					this.pointer[id].needsUpdate = true;
				}
			} else {
				const tracker = this.pointer[id].tracker;
				const info = this.pointer[id].info;

				delete this.pointer[id];

				tracker.animateOut(() => {
					tracker.destroy();

					info.animateOut(() => {
						info.destroy();
					});
				});
			}
		});
	};

	onHeartbeat = ({ id/* , time */ }) => {
		if (!this.connected) {
			this.connected = true;
			this.id = id;

			// store.id = id;

			if (Number(id) !== numPointers) {
				this.pointer[id] = {};
				this.pointer[id].needsUpdate = false;
				this.pointer[id].color = new Color();
				this.pointer[id].last = new Color();
				this.pointer[id].target = new Color();
				this.pointer[id].target.set(lightColor);
				this.pointer[id].color.copy(this.pointer[id].target);
				this.pointer[id].last.copy(this.pointer[id].color);

				this.pointer[id].info = this.ui.detailsUsers.add(new DetailsUser());
			} else {
				store.observer = true;

				this.ui.info.animateIn();
			}

			this.onColor({ value: store.color });

			this.resolve();
		}

		if (store.observer) {
			this.ui.header.color.setData(Data.getUser(id));
		}
	};

	onBuffer = ({ array }) => {
		if (!this.enabled) {
			return;
		}

		if (this.buffer.length > 4) {
			this.buffer.shift();
		}

		this.buffer.push(array);

		this.time = performance.now();
		this.delta = this.time - this.last;
		this.last = this.time;

		if (this.time - 1000 > this.prev) {
			this.fps = Math.round(this.count * 1000 / (this.time - this.prev));
			this.prev = this.time;
			this.count = 0;
		}

		this.count++;
	};

	onContact = ({ body, force }) => {
		AudioController.trigger('flam', body, force);
	};

	// Public methods

	resize = (width, height) => {
		this.halfScreen.set(width / 2, height / 2);

		if (this.animatedIn) {
			return;
		}

		if (width < height) {
			this.position.y = 15;
			this.position.z = 3;
		} else if (width < breakpoint) {
			this.position.y = 13;
			this.position.z = 3;
		} else {
			this.position.y = 13;
			this.position.z = 3;
		}

		this.wobble.origin.copy(this.position);
	};

	// step(array) not used
	update = time => {
		if (!this.enabled) {
			return;
		}

		this.camera.updateMatrixWorld();

		const array = this.buffer.shift() || this.array;
		this.array = array;

		if (array) {
			let index = 0;

			for (let i = 0, il = this.objects.length; i < il; i++) {
				const object = this.objects[i];

				if (object.isInstancedMesh) {
					const bodies = this.map.get(object);

					for (let j = 0, jl = bodies.length; j < jl; j++) {
						this.object.position.fromArray(array, index);
						this.object.quaternion.fromArray(array, index + 3);

						if (object.parent === this.view.ball) {
							const occMesh = this.view.ball.occMesh;

							const id = j.toString();
							const isMove = array[index + 7];
							const isDown = isMove === 2;

							let visibility;

							if (this.pointer[id]) {
								if (this.pointer[id].needsUpdate && !nearEqualsRGB(this.pointer[id].target, this.pointer[id].color)) {
									this.pointer[id].color.lerp(this.pointer[id].target, this.lerpSpeed);
									// this.pointer[id].color.lerpHSL(this.pointer[id].target, this.lerpSpeed);

									this.view.ball.color.copy(this.pointer[id].color);
									this.view.ball.lights[j].color.copy(this.pointer[id].color);

									object.setColorAt(j, this.view.ball.color);
									object.instanceColor.needsUpdate = true;

									occMesh.setColorAt(j, this.view.ball.color);
									occMesh.instanceColor.needsUpdate = true;
								} else {
									this.pointer[id].needsUpdate = false;
								}

								this.screenSpacePosition.copy(this.object.position).project(this.camera).multiply(this.halfScreen);

								if (id !== this.id) {
									if (this.pointer[id].tracker) {
										const centerX = this.halfScreen.x + this.screenSpacePosition.x;
										const centerY = this.halfScreen.y - this.screenSpacePosition.y;

										this.pointer[id].tracker.css({ left: centerX, top: centerY });

										if (isMove && !this.pointer[id].tracker.animatedIn) {
											this.pointer[id].tracker.animateIn();
										}
									}

									visibility = isMove ? isDown ? 1.5 : 1 : 0;
								} else {
									if (!this.progress) {
										this.wobble.update(time);

										this.object.position.copy(this.position);
									} else if (this.progress < 1) {
										this.position.lerp(this.point, this.progress);

										this.object.position.copy(this.position);
									} else if (!this.animatedIn) {
										this.object.position.copy(this.point);
									}

									visibility = isDown ? 1.5 : 1;
								}

								if (this.pointer[id].info) {
									this.pointer[id].info.setData({
										isDown,
										x: this.object.position.x,
										y: this.object.position.y,
										z: this.object.position.z
									});
								}
							} else {
								visibility = 0;
							}

							let strength = object.geometry.attributes.instanceVisibility.array[j];
							strength += (visibility - strength) * this.lerpSpeed;

							if (strength < 0.001) {
								strength = 0;
							}

							this.object.scale.setScalar(clamp(strength, 0, 1));

							object.geometry.attributes.instanceVisibility.array[j] = strength;
							object.geometry.attributes.instanceVisibility.needsUpdate = true;

							this.view.ball.lights[j].position.copy(this.object.position);
							this.view.ball.lights[j].intensity = strength;
							this.view.ball.lights[j].distance = 4.4 * strength;
							this.view.ball.lights[j].visible = !!strength;

							this.object.updateMatrix();

							object.setMatrixAt(j, this.object.matrix);
							occMesh.setMatrixAt(j, this.object.matrix);

							object.instanceMatrix.needsUpdate = true;
							// object.computeBoundingSphere();

							occMesh.instanceMatrix.needsUpdate = true;
							// occMesh.computeBoundingSphere();
						} else {
							this.object.scale.setScalar(1);

							this.object.updateMatrix();

							object.setMatrixAt(j, this.object.matrix);

							object.instanceMatrix.needsUpdate = true;
							// object.computeBoundingSphere();
						}

						index += 8;
					}
				} else {
					object.position.fromArray(array, index);
					object.quaternion.fromArray(array, index + 3);

					index += 8;
				}
			}
		}
	};

	start = () => {
		this.enabled = true;
	};

	animateIn = () => {
		this.motion({
			isDown: false,
			x: this.point.x,
			y: this.point.y,
			z: this.point.z
		});

		tween(this, { progress: 1 }, 1000, 'easeInOutExpo', 2000, () => {
			this.motion({
				isDown: false,
				x: this.point.x,
				y: this.point.y,
				z: this.point.z
			});

			delayedCall(200, () => {
				this.motion({
					isDown: false,
					x: this.point.x,
					y: this.point.y,
					z: this.point.z
				});

				this.animatedIn = true;
			});
		});
	};

	color = text => {
		if (!this.connected) {
			return;
		}

		this.thread.color({ text });
	};

	motion = event => {
		if (!this.connected) {
			return;
		}

		this.thread.motion({ event });
	};

	ready = () => Promise.all([
		this.init(),
		this.promise
	]);
}
