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

// Toggles the filter.
function changeFilter(el) {
    const labels = ['No Filter', 'Filter On'];
    const classNames = ['is-warning', 'is-info'];

    // Toggle state and update element.
    state.isFilterEnabled = !state.isFilterEnabled;
    toggleElement(el, state.isFilterEnabled, labels, classNames);
}

function toggleElement(el, state, labels, classNames) {
    const index = state ? 1 : 0;
    el.value = labels[index];
    el.classList.toggle(classNames[0]);
    el.classList.toggle(classNames[1]);
}
