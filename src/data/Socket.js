import { EventEmitter } from '@alienkitty/space.js/three';

export class Socket extends EventEmitter {
	constructor(server) {
		super();

		this.server = server;

		this.views = [];
		// 0: USERS: EVENT_ID(UINT8), MOUSE_ID(UINT8), COLOR(UINT8), REMOTE_ADDRESS(UINT32), LATENCY(UINT16)
		// 1: HEARTBEAT: EVENT_ID(UINT8), MOUSE_ID(UINT8), TIME(UINT64)
		// 2: BUFFER: EVENT_ID(UINT8), POSITION_X(FLOAT32), POSITION_Y(FLOAT32), POSITION_Z(FLOAT32), QUATERNION_X(FLOAT32), QUATERNION_Y(FLOAT32), QUATERNION_Z(FLOAT32), QUATERNION_W(FLOAT32), IS_SLEEPING(FLOAT32)
		// 3: CONTACT: EVENT_ID(UINT8), BODY_ID(UINT8), FORCE(FLOAT32)
		// 4: COLOR: EVENT_ID(UINT8), MOUSE_ID(UINT8), COLOR(UINT8)
		this.views[4] = new DataView(new ArrayBuffer(1 + 1 + 6));
		// 5: MOTION: EVENT_ID(UINT8), MOUSE_ID(UINT8), IS_DOWN(UINT8), X(FLOAT32), Y(FLOAT32), Z(FLOAT32)
		this.views[5] = new DataView(new ArrayBuffer(1 + 1 + 1 + 4 + 4 + 4));

		this.encoder = new TextEncoder();
		this.decoder = new TextDecoder();

		this.connected = false;

		this.connect();
	}

	addListeners() {
		this.socket.addEventListener('open', this.onOpen);
		this.socket.addEventListener('close', this.onClose);
		this.socket.addEventListener('message', this.onMessage);
	}

	removeListeners() {
		this.socket.removeEventListener('open', this.onOpen);
		this.socket.removeEventListener('close', this.onClose);
		this.socket.removeEventListener('message', this.onMessage);
	}

	ip2long(ip) {
		let ipl = 0;

		ip.split('.').forEach(octet => {
			ipl <<= 8;
			ipl += parseInt(octet, 10);
		});

		return ipl >>> 0;
	}

	long2ip(ipl) {
		return (ipl >>> 24) + '.' + (ipl >> 16 & 255) + '.' + (ipl >> 8 & 255) + '.' + (ipl & 255);
	}

	// Event handlers

	onOpen = () => {
		this.connected = true;

		this.emit('open');
	};

	onClose = () => {
		this.connected = false;

		this.emit('close');
	};

	onMessage = ({ data }) => {
		data = new DataView(data);

		switch (data.getUint8(0)) {
			case 0: {
				const users = [];
				const byteLength = 1 + 6 + 4 + 2;

				let index = 1;

				for (let i = 0, l = (data.byteLength - 1) / byteLength; i < l; i++) {
					const id = data.getUint8(index).toString();
					const color = this.decoder.decode(data.buffer.slice(index + 1, index + 7)).replace(/\0/g, '');
					const remoteAddress = this.long2ip(data.getUint32(index + 7));
					const latency = data.getUint16(index + 11);

					users.push({ id, color, remoteAddress, latency });

					index += byteLength;
				}

				this.emit('users', { users });
				break;
			}
			case 1: {
				const id = data.getUint8(1).toString();
				const time = Number(data.getBigInt64(2));

				this.emit('heartbeat', { id, time });

				this.send(data);
				break;
			}
			case 2: {
				const array = new Float32Array(data.buffer.slice(1));

				this.emit('buffer', { array, buffer: [array.buffer] });
				break;
			}
			case 3: {
				const body = data.getUint8(1);
				const force = data.getFloat32(2);

				this.emit('contact', { body, force });
				break;
			}
		}
	};

	// Public methods

	color = text => {
		const view = this.views[4];
		view.setUint8(0, 4);
		// view.setUint8(1, this.id); // Set server-side

		const buf = this.encoder.encode(text);

		for (let i = 0; i < 6; i++) {
			view.setUint8(2 + i, buf[i]);
		}

		this.send(view);
	};

	motion = ({ isDown, x, y, z }) => {
		const view = this.views[5];
		view.setUint8(0, 5);
		// view.setUint8(1, this.id); // Set server-side
		view.setUint8(2, isDown ? 1 : 0);
		view.setFloat32(3, x);
		view.setFloat32(7, y);
		view.setFloat32(11, z);

		this.send(view);
	};

	send = view => {
		if (!this.connected) {
			return;
		}

		this.socket.send(view.buffer);
	};

	connect = () => {
		if (this.socket) {
			this.close();
		}

		this.socket = new WebSocket(this.server, ['permessage-deflate']);
		this.socket.binaryType = 'arraybuffer';

		this.addListeners();
	};

	close = () => {
		this.removeListeners();

		this.socket.close();
	};
}
