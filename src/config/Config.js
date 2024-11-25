export var isMobile;
export var isTablet;
export var isPhone;
export var isHighQuality;
export var isOrbit;
export var isDebug;

if (typeof window !== 'undefined') {
	isMobile = !!navigator.maxTouchPoints;
	isTablet = isMobile && Math.max(window.innerWidth, window.innerHeight) > 1000;
	isPhone = isMobile && !isTablet;
	isHighQuality = navigator.hardwareConcurrency > 4 || (!navigator.hardwareConcurrency && !isTablet);
	isOrbit = /[?&]orbit/.test(location.search);
	isDebug = /[?&]debug/.test(location.search);
}

export const lightColor = 0xf44336;
export const breakpoint = 1000;
export const numPointers = 22; // iOS limit

export const store = {
	users: [],
	sound: true,
	id: null,
	color: '',
	placeholder: '',
	observer: false
};

export const layers = {
	default: 0,
	buffers: 1,
	occlusion: 2
};
