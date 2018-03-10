'use strict';

// Global state.
var state = {
    renderLoopRequestId: undefined,
    isVideoStarted: false,
    isCameraFlipped: false,
    isGpuMode: true,
    isOutputQrCodeEnabled: false,
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

function getFilterByName(name) {
    return state.filters.filter(filter => filter.name === name)[0];
}

function getParamByName(filter, name) {
    return filter.params.filter(param => param.name === name)[0];
}

function getParamValueByName(filter, name) {
    return getParamByName(filter, name).value;
}
