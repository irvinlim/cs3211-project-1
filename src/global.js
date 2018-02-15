'use strict';

// Constants.
const height = 600;
const width = 800;
const channels = 3;

// Global state.
var state = {
    renderLoopRequestId: undefined,
    isVideoStarted: false,
    isCameraFlipped: false,
    isGpuMode: true,
    filters: [
        {
            name: 'gaussianFilter',
            enabled: false,
            params: [{ name: 'sigma', value: 2 }],
        },
        {
            name: 'edgeDetectionFilter',
            enabled: false,
        },
        {
            name: 'thresholdingFilter',
            enabled: false,
            params: [{ name: 'threshold', value: 0.5 }, { name: 'mode', value: 0 }],
        },
        {
            name: 'embossedFilter',
            enabled: false,
        },
        {
            name: 'lightTunnelFilter',
            enabled: false,
            params: [{ name: 'radius', value: 100 }],
        },
    ],
};

// Vendor-specific getUserMedia shim.
navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
