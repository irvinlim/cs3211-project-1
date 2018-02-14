// Constants.
const height = 600;
const width = 800;

// Global state.
var state = {
    renderLoopRequestId: undefined,
    isVideoStarted: false,
    isGpuMode: true,
    isEmbossedFilterEnabled: false,
    isGaussianFilterEnabled: false,
    isEdgeDetectionFilterEnabled: false,
    isLightTunnelFilterEnabled: false,
};

// Vendor-specific getUserMedia shim.
navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
