'use strict';

function initializeUI() {
    // Add event listeners for filter toggles.
    document.querySelectorAll('.control-filter-toggle').forEach(el => {
        el.addEventListener('click', function(e) {
            const filter = state.filters.filter(filter => filter.name === el.dataset.filterName)[0];
            filter.enabled = !filter.enabled;
            toggleElement(el, filter.enabled, ['Off', 'On'], ['', 'is-info']);
        });
    });

    // Add event listeners for filter sliders.
    document.querySelectorAll('.control-filter-slider').forEach(el => {
        el.addEventListener('mousemove', function(e) {
            const filter = state.filters.filter(filter => filter.name === el.dataset.filterName)[0];
            const param = filter.params.filter(param => param.name === el.dataset.paramName)[0];
            param.value = parseFloat(el.value);
        });
    });

    // Initialize sortable.
    sortable('.sortable', {
        items: '.panel-block',
        handle: '.handle img',
        forcePlaceholderSize: true,
    });

    // Listen for sort updates.
    sortable('.sortable')[0].addEventListener('sortupdate', function(e) {
        const oldIndex = e.detail.oldElementIndex - 1;
        const newIndex = e.detail.elementIndex - 1;

        // Reorder items in state.filters.
        state.filters.splice(newIndex, 0, state.filters.splice(oldIndex, 1)[0]);
    });
}

addEventListener('DOMContentLoaded', initializeUI);

// Toggles the status of the video stream.
function toggleStatus(el) {
    const labels = ['Start', 'Pause'];
    const classNames = ['is-success', 'is-danger'];

    // Toggle state and update element.
    state.isVideoStarted = !state.isVideoStarted;
    toggleElement(el, state.isVideoStarted, labels, classNames);

    // Handle side-effects.
    if (state.isVideoStarted) {
        state.renderLoopRequestId = window.requestAnimationFrame(renderLoop);
    } else {
        window.cancelAnimationFrame(state.renderLoopRequestId);
        state.renderLoopRequestId = undefined;
    }
}

// Changes the CPU/GPU state.
function toggleMode(el) {
    const labels = ['CPU', 'GPU'];
    const classNames = ['is-warning', 'is-info'];

    // Toggle state and update element.
    state.isGpuMode = !state.isGpuMode;
    toggleElement(el, state.isGpuMode, labels, classNames);
}

// Changes the camera flipped state.
function toggleCameraFlipped(el) {
    const labels = ['No', 'Yes'];
    const classNames = ['', ''];

    // Toggle state and update element.
    state.isCameraFlipped = !state.isCameraFlipped;
    toggleElement(el, state.isCameraFlipped, labels, classNames);
}

// Convenience function to toggle the visual state of a toggle button.
function toggleElement(el, state, labels, classNames) {
    const index = state ? 1 : 0;
    el.value = labels[index];
    if (classNames[index].length) el.classList.add(classNames[index]);
    if (classNames[index ^ 1].length) el.classList.remove(classNames[index ^ 1]);
}
