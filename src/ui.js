// Toggles the status of the video stream.
function toggleStatus(el) {
    const labels = ['Stopped', 'Started'];
    const classNames = ['is-danger', 'is-success'];

    // Toggle state and update element.
    state.isVideoStarted = !state.isVideoStarted;
    toggleElement(el, state.isVideoStarted, labels, classNames);

    // Handle side-effects.
    if (state.isVideoStarted) {
        state.renderLoopRequestId = window.requestAnimationFrame(renderLoop);
    } else {
        window.cancelAnimationFrame(renderLoopRequestId);
        state.renderLoopRequestId = undefined;
    }
}

// Changes the CPU/GPU state.
function toggleMode(el) {
    const labels = ['Using CPU', 'Using GPU'];
    const classNames = ['is-warning', 'is-info'];

    // Toggle state and update element.
    state.isGpuMode = !state.isGpuMode;
    toggleElement(el, state.isGpuMode, labels, classNames);
}

// Toggles the embossed filter.
function toggleEmbossedFilter(el) {
    const labels = ['Embossed Filter Off', 'Embossed Filter On'];
    const classNames = ['is-warning', 'is-info'];

    // Toggle state and update element.
    state.isEmbossedFilterEnabled = !state.isEmbossedFilterEnabled;
    toggleElement(el, state.isEmbossedFilterEnabled, labels, classNames);
}

// Toggles the gaussian filter.
function toggleGaussianFilter(el) {
    const labels = ['Gaussian Filter (5x5) Off', 'Gaussian Filter (5x5) On'];
    const classNames = ['is-warning', 'is-info'];

    // Toggle state and update element.
    state.isGaussianFilterEnabled = !state.isGaussianFilterEnabled;
    toggleElement(el, state.isGaussianFilterEnabled, labels, classNames);
}

// Toggles the edge detection filter.
function toggleEdgeDetectionFilter(el) {
    const labels = ['Edge Detection Off', 'Edge Detection On'];
    const classNames = ['is-warning', 'is-info'];

    // Toggle state and update element.
    state.isEdgeDetectionFilterEnabled = !state.isEdgeDetectionFilterEnabled;
    toggleElement(el, state.isEdgeDetectionFilterEnabled, labels, classNames);
}

function toggleElement(el, state, labels, classNames) {
    const index = state ? 1 : 0;
    el.value = labels[index];
    el.classList.toggle(classNames[0]);
    el.classList.toggle(classNames[1]);
}
