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
            params: [
                { name: 'sigma', value: 2 },
                { name: 'k00', value: 0 },
                { name: 'k01', value: 0 },
                { name: 'k02', value: 0 },
                { name: 'k11', value: 0 },
                { name: 'k12', value: 0 },
                { name: 'k22', value: 0 },
            ],
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

// Precompute the Gaussian coefficients.
(function() {
    const filter = getFilterByName('gaussianFilter');
    const sigma = getParamValueByName(filter, 'sigma');
    getParamByName(filter, 'k00').value = gaussianFunction(0, 0, sigma);
    getParamByName(filter, 'k01').value = gaussianFunction(0, 1, sigma);
    getParamByName(filter, 'k02').value = gaussianFunction(0, 2, sigma);
    getParamByName(filter, 'k11').value = gaussianFunction(1, 1, sigma);
    getParamByName(filter, 'k12').value = gaussianFunction(1, 2, sigma);
    getParamByName(filter, 'k22').value = gaussianFunction(2, 2, sigma);
})();
