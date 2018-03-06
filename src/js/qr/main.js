'use strict';

// Constants.
const height = 450;
const width = 600;
const qrCodeLength = 203;
const qrCodeDimension = 29;
const channels = 3;

const plotPointColors = [[1, 0, 0], [0, 1, 0], [0, 1, 1], [1, 0, 1]];

// Set default threshold level for this page.
const defaultThresholdLevel = 0.5;

const thresholdFilter = getFilterByName('thresholdingFilter');
const thresholdParam = thresholdFilter.params.filter(p => p.name === 'threshold')[0];
thresholdParam.value = defaultThresholdLevel;
const thresholdInput = 'input[data-filter-name=thresholdingFilter][data-param-name=threshold]';
document.querySelector(thresholdInput).value = defaultThresholdLevel;

const KC = {
    LEFT_IMAGE: 'leftImage',
    RIGHT_IMAGE: 'rightImage',
};

const K = {
    TRANSFORM_IMAGE_DATA: 'transformLinearToXYZ',
    THRESHOLD_FILTER: 'thresholdFilter',
    MEDIAN_FILTER: 'medianFilter',
    MARKER_DETECTION_ROW_WISE: 'markerDetectionRowWise',
    MARKER_DETECTION_COL_WISE: 'markerDetectionColWise',
    MARKER_DETECTION_COMBINED: 'markerDetectionCombined',
    MARKER_DETECTION_TOP: 'markerDetectionTop',
    QR_CALCULATE_CORNERS: 'calculateCorners',
    QR_PERSPECTIVE_WARP: 'perspectiveWarp',
    PLOT_MARKERS: 'plotMarkers',
    OUTLINE_QR_CODE: 'plotPoints',
    RENDER_LEFT: 'renderLeftImage',
    RENDER_LEFT_COLOR: 'renderLeftImageColor',
    RENDER_QR_CODE: 'renderQrCode',
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
    addKernel(createMarkerDetectionRowWise, KC.LEFT_IMAGE, K.MARKER_DETECTION_ROW_WISE);
    addKernel(createMarkerDetectionColWise, KC.LEFT_IMAGE, K.MARKER_DETECTION_COL_WISE);
    addKernel(createMarkerDetectionCombined, KC.LEFT_IMAGE, K.MARKER_DETECTION_COMBINED);
    addKernel(createMarkerDetectionTop, KC.LEFT_IMAGE, K.MARKER_DETECTION_TOP);
    addKernel(createCalculateCorners, KC.LEFT_IMAGE, K.QR_CALCULATE_CORNERS);
    addKernel(createPerspectiveWarp, KC.RIGHT_IMAGE, K.QR_PERSPECTIVE_WARP);
    addKernel(createPlotMarkers, KC.LEFT_IMAGE, K.PLOT_MARKERS);
    addKernel(createOutlineQrCode, KC.LEFT_IMAGE, K.OUTLINE_QR_CODE);
    addKernel(createRenderGreyscale, KC.LEFT_IMAGE, K.RENDER_LEFT, true);
    addKernel(createRenderColor, KC.LEFT_IMAGE, K.RENDER_LEFT_COLOR, true);
    addKernel(createRenderQrCode, KC.RIGHT_IMAGE, K.RENDER_QR_CODE, true);

    // Create canvases for CPU and GPU for each of the renderGraphical kernels.
    createCanvas(K.RENDER_LEFT, '.canvas-wrapper.original', width, height);
    createCanvas(K.RENDER_QR_CODE, '.canvas-wrapper.thresholded', qrCodeLength, qrCodeLength);
}

addEventListener('DOMContentLoaded', initialize);

function renderLoop() {
    // Calculate and display FPS.
    document.querySelector('#fps').innerHTML = fps.getFPS();

    // Fetches image data from the video canvas.
    const imageData = fetchVideoImageData();

    // Transform linear image data into 3-D array for proper computation.
    const cameraFlipped = state.isCameraFlipped ? 1 : 0;
    const originalImage = getKernel(K.TRANSFORM_IMAGE_DATA)(imageData, cameraFlipped);

    // Threshold the original image.
    const thresholdFilterState = getFilterByName('thresholdingFilter');
    const thresholdLevel = getParamValueByName(thresholdFilterState, 'threshold');
    const thresholdedImage = getKernel(K.THRESHOLD_FILTER)(originalImage, thresholdLevel, 0);

    // Apply median filter to remove artifacts after thresholding.
    const filteredImage = getKernel(K.MEDIAN_FILTER)(thresholdedImage);

    // Identify markers.
    const rowWise = getKernel(K.MARKER_DETECTION_ROW_WISE)(filteredImage, 0);
    const colWise = getKernel(K.MARKER_DETECTION_COL_WISE)(filteredImage, 1);
    const topMarkers = getKernel(K.MARKER_DETECTION_TOP)(rowWise, colWise);

    // Calculate the corners of the QR code.
    const corners = getKernel(K.QR_CALCULATE_CORNERS)(rowWise, colWise, topMarkers);

    // Outline the QR code on the original image.
    const outlinedQrCode = getKernel(K.OUTLINE_QR_CODE)(filteredImage, corners, plotPointColors);

    // Render the outlined QR code.
    getKernel(K.RENDER_LEFT_COLOR, true)(outlinedQrCode);

    // const markerLocationsCombined = getKernel(K.MARKER_DETECTION_COMBINED)(rowWise, colWise);
    // const markersPlotted = getKernel(K.PLOT_MARKERS)(thresholdedImage, markerLocationsCombined);

    // Render the QR code in the 2nd canvas if enabled.
    if (state.isOutputQrCodeEnabled) {
        // Copy the left image so that we can render it later.
        // Note that this is the expensive step as we have to transfer data from GPU back to CPU and back again.
        const leftImageCopy = getKernel(K.CONVERT_TO_ARRAY)(filteredImage);

        // Perform perspective transform on the image based on the markers found.
        const warpedQrCode = getKernel(K.QR_PERSPECTIVE_WARP)(leftImageCopy, corners, qrCodeDimension);

        // Render the extracted QR code.
        getKernel(K.RENDER_QR_CODE, true)(warpedQrCode);
    }

    // Fix canvas sizes.
    setCanvasSize(K.RENDER_LEFT, width, height);
    setCanvasSize(K.RENDER_QR_CODE, qrCodeLength, qrCodeLength);

    // Request next frame to render.
    state.renderLoopRequestId = requestAnimationFrame(renderLoop);
}

function createCanvas(kernelName, containerSelector, width, height) {
    const canvas = kernels.gpu[kernelName].getCanvas();
    document.querySelector(containerSelector).appendChild(canvas);
    canvas.width = width;
    canvas.height = height;
}

function setCanvasSize(kernelName, width, height) {
    const canvas = getKernel(kernelName, true).getCanvas();
    canvas.width = width;
    canvas.height = height;
}
