import { Socket } from './Socket.js';

export class SocketThread {
	constructor() {
		this.addListeners();
	}

	addListeners() {
		addEventListener('message', this.onMessage);
	}

	// Event handlers

	onMessage = ({ data }) => {
		this[data.message.fn].call(this, data.message);
	};

	onOpen = () => {
		postMessage({ event: 'open' });
	};

	onClose = () => {
		postMessage({ event: 'close' });
	};

	onUsers = e => {
		postMessage({ event: 'users', message: e });
	};

	onHeartbeat = e => {
		postMessage({ event: 'heartbeat', message: e });
	};

	onBuffer = ({ array, buffer }) => {
		postMessage({ event: 'buffer', message: { array } }, buffer);
	};

	onContact = e => {
		postMessage({ event: 'contact', message: e });
	};

	// Public methods

	init = ({ server }) => {
		this.socket = new Socket(server);
		this.socket.on('open', this.onOpen);
		this.socket.on('close', this.onClose);
		this.socket.on('users', this.onUsers);
		this.socket.on('heartbeat', this.onHeartbeat);
		this.socket.on('buffer', this.onBuffer);
		this.socket.on('contact', this.onContact);
	};

	color = ({ text }) => {
		this.socket.color(text);
	};

	motion = ({ event }) => {
		this.socket.motion(event);
	};
}
