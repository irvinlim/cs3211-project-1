'use strict';

// Constants.
const height = 300;
const width = 400;
const channels = 3;

const KC = {
    LEFT_IMAGE: 'leftImage',
    RIGHT_IMAGE: 'rightImage',
};

const K = {
    TRANSFORM_IMAGE_DATA: 'transformLinearToXYZ',
    THRESHOLD_FILTER: 'thresholdFilter',
    EDGE_DETECTION_FILTER: 'edgeDetectionFilter',
    MARKER_DETECTION: 'markerDetection',
    PLOT_MARKERS: 'plotMarkers',
    RENDER_LEFT: 'renderLeftImage',
    RENDER_RIGHT: 'renderRightImage',
    CONVERT_TO_ARRAY: 'convertToArray',
};

function initialize() {
    // Initialize the video elements and stream handler.
    initializeVideo();

    // Initialize kernel creators and add kernels.
    initKernelCreator(KC.LEFT_IMAGE);
    initKernelCreator(KC.RIGHT_IMAGE);
    addKernel(createTransformLinearToXYZ, KC.LEFT_IMAGE, K.TRANSFORM_IMAGE_DATA);
    addKernel(createReturnNonTexture2D, KC.LEFT_IMAGE, K.CONVERT_TO_ARRAY);
    addKernel(createThresholdingFilter, KC.LEFT_IMAGE, K.THRESHOLD_FILTER);
    addKernel(createRenderGreyscale, KC.LEFT_IMAGE, K.RENDER_LEFT, true);
    addKernel(createEdgeDetectionFilter, KC.RIGHT_IMAGE, K.EDGE_DETECTION_FILTER);
    addKernel(createMarkerDetection, KC.RIGHT_IMAGE, K.MARKER_DETECTION);
    addKernel(createPlotMarkers, KC.RIGHT_IMAGE, K.PLOT_MARKERS);
    addKernel(createRenderColor, KC.RIGHT_IMAGE, K.RENDER_RIGHT, true);

    // Create canvases for CPU and GPU for each of the renderGraphical kernels.
    createCanvas(K.RENDER_LEFT, '.canvas-wrapper.original');
    createCanvas(K.RENDER_RIGHT, '.canvas-wrapper.thresholded');
}

addEventListener('DOMContentLoaded', initialize);

function renderLoop() {
    // Calculate and display FPS.
    document.querySelector('#fps').innerHTML = fps.getFPS();

    // Fetches image data from the video canvas.
    const imageData = fetchVideoImageData();

    // Transform linear image data into 3-D array for proper computation.
    const originalImage = getKernel(K.TRANSFORM_IMAGE_DATA)(
        imageData,
        width,
        height,
        state.isCameraFlipped ? 1 : 0
    );

    // Threshold the original image.
    const thresholdedImage = getKernel(K.THRESHOLD_FILTER)(originalImage, 0.5, 0);

    // Edge detection.
    // const edgedDetectedImage = getKernel(K.EDGE_DETECTION_FILTER)(thresholdedImage, width, height);

    // Copy the left image so that we can render it later.
    // Note that this is the expensive step as we have to transfer data from GPU back to CPU and back again.
    const leftImageCopy = getKernel(K.CONVERT_TO_ARRAY)(thresholdedImage);

    // Identify markers.
    const markerLocations = getKernel(K.MARKER_DETECTION)(leftImageCopy);

    // Plot markers on the image.
    const markersPlotted = getKernel(K.PLOT_MARKERS)(leftImageCopy, markerLocations);

    // Render each of the images at each stage.
    getKernel(K.RENDER_LEFT, true)(thresholdedImage);
    getKernel(K.RENDER_RIGHT, true)(markersPlotted);

    // Fix canvas sizes.
    setCanvasSize(K.RENDER_LEFT, '.canvas-wrapper.original');
    setCanvasSize(K.RENDER_RIGHT, '.canvas-wrapper.thresholded');

    // Request next frame to render.
    state.renderLoopRequestId = requestAnimationFrame(renderLoop);
}

function createCanvas(kernelName, containerSelector) {
    const canvas = kernels.gpu[kernelName].getCanvas();
    document.querySelector(containerSelector).appendChild(canvas);
    canvas.width = width;
    canvas.height = height;
}

function setCanvasSize(kernelName) {
    const canvas = getKernel(kernelName, true).getCanvas();
    canvas.width = width;
    canvas.height = height;
}
