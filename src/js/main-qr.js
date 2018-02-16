'use strict';

// Constants.
const height = 300;
const width = 400;
const channels = 3;

function initialize() {
    // Initialize the video elements and stream handler.
    initializeVideo();

    // Create a Canvas for both CPU and GPU modes.
    const cpuCanvas = cpuKernels.renderGraphical.getCanvas();
    const gpuCanvas = gpuKernels.renderGraphical.getCanvas();
    document.querySelector('.canvas-wrapper').appendChild(cpuCanvas);
    document.querySelector('.canvas-wrapper').appendChild(gpuCanvas);
    cpuCanvas.width = width;
    cpuCanvas.height = height;
    gpuCanvas.width = width;
    gpuCanvas.height = height;
}

addEventListener('DOMContentLoaded', initialize);

function renderLoop() {
    // Calculate and display FPS.
    document.querySelector('#fps').innerHTML = fps.getFPS();

    // Fetches image data from the video canvas.
    let data = fetchVideoImageData();

    /// MAIN SECTION
    /// Filter, detect and decode the QR code from the video stream.

    // Transform linear image data into 3-D array for proper computation.
    data = getKernel('transformLinearToXYZ')(data, state.isCameraFlipped ? 1 : 0);

    // Threshold

    // Render image in the final canvas.
    getKernel('renderGraphical')(data);

    // Show only the current canvas and fix the size.
    const canvas = getKernel('renderGraphical').getCanvas();
    document.querySelectorAll('.canvas-wrapper canvas').forEach(el => (el.style.display = 'none'));
    canvas.style.display = 'inline';
    canvas.width = width;
    canvas.height = height;

    // Request next frame to render.
    state.renderLoopRequestId = requestAnimationFrame(renderLoop);
}
