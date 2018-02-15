'use strict';

function initialize() {
    // Initialize video element.
    const video = document.getElementById('video');
    video.style.height = height;
    video.style.width = width;

    // Add event handlers to receive video stream from camera.
    const streamHandler = stream => {
        video.src = URL.createObjectURL(stream);
        video.play();
    };

    if (typeof navigator.mediaDevices.getUserMedia === 'undefined') {
        navigator.getUserMedia({ video: true, audio: false }, streamHandler);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(streamHandler);
    }

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

    // Draw the contents of the video on the video canvas.
    const video = document.getElementById('video');
    const context = document.getElementById('videoCanvas').getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    // Extract the image data from the canvas.
    let data = context.getImageData(0, 0, width, height).data;

    /// MAIN SECTION
    /// Execute kernel functions to process and render image for this frame.

    // Transform linear image data into 3-D array for proper computation.
    data = getKernel('transformLinearToXYZ')(data);

    // Execute each of the filters that are enabled in order, and pass any parameters
    // to the kernel function in the GPU.
    const enabledFilters = state.filters.filter(filter => filter.enabled);

    enabledFilters.forEach(filter => {
        const params = typeof filter.params === 'undefined' ? [] : filter.params;
        const paramValues = params.map(param => param.value);
        const kernelFunction = getKernel(filter.name);

        // Call kernel function with arguments.
        const args = [data].concat(paramValues);
        data = kernelFunction.apply(null, args);
    });

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
