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
    MEDIAN_FILTER: 'medianFilter',
    EDGE_DETECTION_FILTER: 'edgeDetectionFilter',
    MARKER_DETECTION_ROW_WISE: 'markerDetectionRowWise',
    MARKER_DETECTION_COL_WISE: 'markerDetectionColWise',
    MARKER_DETECTION_COMBINED: 'markerDetectionCombined',
    PLOT_MARKERS: 'plotMarkers',
    RENDER_LEFT: 'renderLeftImage',
    RENDER_LEFT_COLOR: 'renderLeftImageColor',
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
    addKernel(createMedianFilter, KC.LEFT_IMAGE, K.MEDIAN_FILTER);
    addKernel(createEdgeDetectionFilter, KC.LEFT_IMAGE, K.EDGE_DETECTION_FILTER);
    addKernel(createRenderGreyscale, KC.LEFT_IMAGE, K.RENDER_LEFT, true);
    addKernel(createMarkerDetectionRowWise, KC.LEFT_IMAGE, K.MARKER_DETECTION_ROW_WISE);
    addKernel(createMarkerDetectionColWise, KC.LEFT_IMAGE, K.MARKER_DETECTION_COL_WISE);
    addKernel(createMarkerDetectionCombined, KC.LEFT_IMAGE, K.MARKER_DETECTION_COMBINED);
    addKernel(createPlotMarkers, KC.LEFT_IMAGE, K.PLOT_MARKERS);
    addKernel(createRenderColor, KC.LEFT_IMAGE, K.RENDER_LEFT_COLOR, true);
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

    // Apply median filter to remove artifacts after thresholding.
    const medianFilteredImage = getKernel(K.MEDIAN_FILTER)(thresholdedImage, width, height);

    // Edge detection.
    // const edgedDetectedImage = getKernel(K.EDGE_DETECTION_FILTER)(thresholdedImage, width, height);

    // Identify markers.
    const rowWise = getKernel(K.MARKER_DETECTION_ROW_WISE)(medianFilteredImage);
    const colWise = getKernel(K.MARKER_DETECTION_COL_WISE)(medianFilteredImage);
    const markerLocationsCombined = getKernel(K.MARKER_DETECTION_COMBINED)(rowWise, colWise);

    // Plot markers on the image.
    const markersPlotted = getKernel(K.PLOT_MARKERS)(originalImage, markerLocationsCombined);

    // Copy the left image so that we can render it later.
    // Note that this is the expensive step as we have to transfer data from GPU back to CPU and back again.
    // const rightImage = getKernel(K.CONVERT_TO_ARRAY)(markersPlotted);

    // Render each of the images at each stage.
    getKernel(K.RENDER_LEFT_COLOR, true)(markersPlotted);
    // getKernel(K.RENDER_RIGHT, true)(markersPlotted);

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
