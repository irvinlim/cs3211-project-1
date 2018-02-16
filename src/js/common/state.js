'use strict';

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
