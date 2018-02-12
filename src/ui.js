var selection = 0;
var filtering = 0;
var counter = 0;

// Toggles the status of the program.
function toggleStatus(el) {
    if (el.value === 'Stopped') {
        // Start the program.
        el.value = 'Started';
        el.classList.remove('is-danger');
        el.classList.add('is-success');
        renderLoop();
    } else {
        // Stop the program.
        el.value = 'Stopped';
        el.classList.add('is-danger');
        el.classList.remove('is-success');
        window.cancelAnimationFrame(renderLoopRequestId);
        renderLoopRequestId = undefined;
    }
}

// Changes the CPU/GPU state.
function change(el) {
    if (el.value === 'Using CPU') {
        selection = 1;
        el.value = 'Using GPU';
    } else {
        selection = 0;
        el.value = 'Using CPU';
    }
}

// Toggles the filter.
function changeFilter(el) {
    if (el.value === 'Filtering') {
        filtering = 1;
        el.value = 'No Filter';
    } else {
        filtering = 0;
        el.value = 'Filtering';
    }
}
