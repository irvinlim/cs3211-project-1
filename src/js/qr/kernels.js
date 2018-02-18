'use strict';

const kernelCreators = {
    gpu: {},
    cpu: {},
};

const kernels = {
    gpu: {},
    cpu: {},
};

/// ------------------------
/// START KERNEL DEFINITIONS
/// ------------------------

// Kernel: Transforms a linear array of image data into (x,y) data in a single greyscale channel.
// Input:  1-D array, where every 4 elements represents the R, G, B, A channel values respectively.
//         Values are from 0 to 255.
// Output: 2-D array (2 channels).
const createTransformLinearToXYZ = createStandardKernel(
    function(imageData, width, height, isCameraFlipped) {
        var x, y;

        // Input image data is y-inverted so we need to read from bottom up.
        y = 4 * width * (height - this.thread.y - 1);

        // Optionally flip the camera if the argument is true.
        if (isCameraFlipped === 0) x = 4 * this.thread.x;
        else x = 4 * (width - this.thread.x);

        // Convert RGB to greyscale using luminance formula.
        var r = imageData[x + y];
        var g = imageData[x + y + 1];
        var b = imageData[x + y + 2];
        var luminance = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);

        // Input image data is an integer between 0 to 255, but should return float between 0 to 1.
        return luminance / 256;
    },
    {
        output: [width, height],
        outputToTexture: true,
    }
);

// Kernel: Thresholding filter
const createThresholdingFilter = createStandardKernel(
    function(A, threshold, mode) {
        var brightness = A[this.thread.y][this.thread.x];

        // THRESH_BINARY
        if (mode === 0) {
            if (brightness < threshold) return 0;
            else return 1;
        }

        // THRESH_BINARY_INV
        if (mode === 1) {
            if (brightness < threshold) return 1;
            else return 0;
        }

        // THRESH_TRUNC
        if (mode === 2) {
            if (brightness < threshold) return brightness;
            else return 1;
        }

        // THRESH_TOZERO
        if (mode === 3) {
            if (brightness < threshold) return 0;
            else return brightness;
        }

        // THRESH_TOZERO_INV
        if (mode === 4) {
            if (brightness < threshold) return brightness;
            else return 0;
        }
    },
    {
        output: [width, height],
        outputToTexture: true,
    }
);

// Kernel: Median filter (window size = 3)
const createMedianFilter = createStandardKernel(
    function(A, width, height) {
        var left, mid, right;

        if (this.thread.x <= 0) left = A[this.thread.y][this.thread.x];
        else left = A[this.thread.y][this.thread.x - 1];

        mid = A[this.thread.y][this.thread.x];

        if (this.thread.x >= width - 1) right = A[this.thread.y][this.thread.x];
        else right = A[this.thread.y][this.thread.x + 1];

        if (left >= mid && left >= right) return left;
        else if (mid >= left && mid >= right) return mid;
        else return right;
    },
    {
        output: [width, height],
        outputToTexture: true,
    }
);

// Kernel: Edge detection (Sobel) filter
const createEdgeDetectionFilter = createStandardKernel(
    function(A, width, height) {
        if (
            this.thread.y > 0 &&
            this.thread.y < height - 1 &&
            this.thread.x < width - 1 &&
            this.thread.x > 0
        ) {
            var Gx =
                A[this.thread.y - 1][this.thread.x - 1] +
                A[this.thread.y - 1][this.thread.x + 1] * -1 +
                A[this.thread.y][this.thread.x - 1] * 2 +
                A[this.thread.y][this.thread.x + 1] * -2 +
                A[this.thread.y + 1][this.thread.x - 1] +
                A[this.thread.y + 1][this.thread.x + 1] * -1;

            var Gy =
                A[this.thread.y - 1][this.thread.x - 1] +
                A[this.thread.y - 1][this.thread.x] * 2 +
                A[this.thread.y - 1][this.thread.x + 1] +
                A[this.thread.y + 1][this.thread.x - 1] * -1 +
                A[this.thread.y + 1][this.thread.x] * -2 +
                A[this.thread.y + 1][this.thread.x + 1] * -1;

            return Math.sqrt(Gx * Gx + Gy * Gy);
        } else {
            return A[this.thread.y][this.thread.x];
        }
    },
    {
        output: [width, height],
        outputToTexture: true,
    }
);

// Kernel: Try and detect QR code markers.
// Output: 1-D array corresponding to each row of the image.
//         If the value is > 0, then it specifies the location of a possible marker in the row.
//
// This approximation algorithm (without knowledge of higher order CV algorithms) is adapted from
// the sample C++ code at http://aishack.in/tutorials/scanning-qr-codes-2/.
const createMarkerDetectionRowWise = createStandardKernel(
    function(A) {
        // Keep track of the current state:
        // QR code marker has this: B > W > B > W > B (1:1:3:1:1 ratio).
        var currState = 0;

        // Keep track of pixels counted within each state.
        // Cannot instantiate dynamic array so we have to do it like this.
        var px0 = 0;
        var px1 = 0;
        var px2 = 0;
        var px3 = 0;
        var px4 = 0;

        var foundMarker = 0;

        // Iterate through all pixels in the current row.
        for (var i = 0; i < this.constants.width; i++) {
            if (A[this.thread.x][i] === 0) {
                // Black pixel

                // Was at white, so we advance the state.
                if (currState === 1 || currState === 3) currState++;

                // Increment the pixel count via poor man's array.
                if (currState === 2) px2++;
                if (currState === 4) px4++;
            } else {
                // White pixel

                // Handle the case where we have reached the end of the sequence.
                if (currState === 4) {
                    // If the ratio is not right, we translate the sequence leftwards by 2 slots,
                    // and continue iterating.
                    if (checkQrMarkerRatio(px0, px1, px2, px3, px4) === 0) {
                        currState = 3;
                        px0 = px2;
                        px1 = px3;
                        px2 = px4;
                        px3 = 1;
                        px4 = 0;
                    } else {
                        // Otherwise, we have found a possible marker.
                        // Return the center x-coordinate of the marker.
                        var totalWidth = px0 + px1 + px2 + px3 + px4;
                        foundMarker = Math.floor(i - totalWidth / 2);
                        break;
                    }
                } else {
                    // Was at black (and not at end), so we advance the state.
                    if (currState === 0 || currState === 2) currState++;

                    // Increment the pixel count via poor man's array.
                    if (currState === 1) px1++;
                    if (currState === 3) px3++;
                }
            }
        }

        return foundMarker;
    },
    {
        output: [height],
        outputToTexture: true,
        functions: { checkQrMarkerRatio },
    }
);

// Kernel: Try and detect QR code markers. This time column wise.
// Make use of previously computed possible marker x-positions for each row
// and coalesce with those found using this method.
const createMarkerDetectionColWise = createStandardKernel(
    function(A) {
        // Keep track of the current state:
        // QR code marker has this: B > W > B > W > B (1:1:3:1:1 ratio).
        var currState = 0;

        // Keep track of pixels counted within each state.
        // Cannot instantiate dynamic array so we have to do it like this.
        var px0 = 0;
        var px1 = 0;
        var px2 = 0;
        var px3 = 0;
        var px4 = 0;

        var foundMarker = 0;

        // Iterate through all pixels in the current row.
        for (var i = 0; i < this.constants.height; i++) {
            if (A[i][this.thread.x] === 0) {
                // Black pixel

                // Was at white, so we advance the state.
                if (currState === 1 || currState === 3) currState++;

                // Increment the pixel count via poor man's array.
                if (currState === 2) px2++;
                if (currState === 4) px4++;
            } else {
                // White pixel

                // Handle the case where we have reached the end of the sequence.
                if (currState === 4) {
                    // If the ratio is not right, we translate the sequence leftwards by 2 slots,
                    // and continue iterating.
                    if (checkQrMarkerRatio(px0, px1, px2, px3, px4) === 0) {
                        currState = 3;
                        px0 = px2;
                        px1 = px3;
                        px2 = px4;
                        px3 = 1;
                        px4 = 0;
                    } else {
                        // Otherwise, we have found a possible marker.
                        // Return the center y-coordinate of the marker.
                        var totalWidth = px0 + px1 + px2 + px3 + px4;
                        var centerY = Math.floor(i - totalWidth / 2);

                        // We say that we have found a marker if the previously computed
                        // x-position is off from the x-position of this newly found center
                        // by less than a specific error margin.
                        // if (
                        //     centerY >= 0 &&
                        //     markerRows[centerY] > 0 &&
                        //     Math.abs(i - markerRows[centerY]) <= errorMargin
                        // ) {
                        foundMarker = centerY;
                        break;
                        // }
                    }
                } else {
                    // Was at black (and not at end), so we advance the state.
                    if (currState === 0 || currState === 2) currState++;

                    // Increment the pixel count via poor man's array.
                    if (currState === 1) px1++;
                    if (currState === 3) px3++;
                }
            }
        }

        return foundMarker;
    },
    {
        output: [width],
        outputToTexture: true,
        functions: { checkQrMarkerRatio },
    }
);

// Kernel: Combine column- and row-wise computations.
const createMarkerDetectionCombined = createStandardKernel(
    function(rows, cols) {
        var col = cols[this.thread.x];
        var row = rows[this.thread.y];

        if (row > 0 && col > 0 && this.thread.x === row && this.thread.y === col) {
            return 1;
        } else {
            return 0;
        }
    },
    {
        output: [width, height],
        outputToTexture: true,
    }
);

// Kernel: Plot possible QR code markers on an image.
// Inputs: A - 2-D image data.
//         markerLocations - Boolean matrix of center of marker locations.
const createPlotMarkers = createStandardKernel(
    function(A, markerLocations) {
        var squareSize = 10;
        var radius = Math.floor(squareSize / 2);
        var isBorder = 0;

        for (var i = 0; i < squareSize; i++) {
            if (this.thread.y - radius >= 0) {
                // Handle left border.
                if (this.thread.x + radius < this.constants.width) {
                    if (markerLocations[this.thread.y - radius + i][this.thread.x + radius] === 1) {
                        isBorder = 1;
                        break;
                    }
                }

                // Handle right border.
                if (this.thread.x - radius >= 0) {
                    if (markerLocations[this.thread.y - radius + i][this.thread.x - radius] === 1) {
                        isBorder = 1;
                        break;
                    }
                }
            }

            if (this.thread.x - radius >= 0) {
                // Handle top border.
                if (this.thread.y - radius >= 0) {
                    if (markerLocations[this.thread.y - radius][this.thread.x - radius + i] === 1) {
                        isBorder = 1;
                        break;
                    }
                }

                // Handle bottom border.
                if (this.thread.y + radius < this.constants.height) {
                    if (markerLocations[this.thread.y + radius][this.thread.x - radius + i] === 1) {
                        isBorder = 1;
                        break;
                    }
                }
            }
        }

        // Draw borders.
        if (isBorder === 1) {
            if (this.thread.z === 0) return 1;
            else return 0;
        } else {
            return A[this.thread.y][this.thread.x];
        }
    },
    {
        output: [width, height, channels],
        outputToTexture: true,
    }
);

const createReturnNonTexture = createStandardKernel(
    function(A) {
        return A[this.thread.z][this.thread.y][this.thread.x];
    },
    { output: [width, height, channels] }
);

const createReturnNonTexture2D = createStandardKernel(
    function(A) {
        return A[this.thread.y][this.thread.x];
    },
    { output: [width, height] }
);

// Kernel: Render images in color.
// Input:  3-D array (3 channels)
const createRenderColor = createStandardKernel(
    function(A) {
        var r = A[0][this.thread.y][this.thread.x];
        var g = A[1][this.thread.y][this.thread.x];
        var b = A[2][this.thread.y][this.thread.x];

        this.color(r, g, b, 1);
    },
    {
        output: [width, height],
        graphical: true,
    }
);

// Kernel: Render images in greyscale.
// Input:  2-D array (1 channel)
const createRenderGreyscale = createStandardKernel(
    function(A) {
        var value = A[this.thread.y][this.thread.x];
        this.color(value, value, value, 1);
    },
    {
        output: [width, height],
        graphical: true,
    }
);

/// ----------------------
/// START CUSTOM FUNCTIONS
/// ----------------------

// Checks the ratio of a QR code sequence if it follows the 1:1:3:1:1 ratio,
// subject to variance of +/- 50%.
function checkQrMarkerRatio(px0, px1, px2, px3, px4) {
    var totalWidth = px0 + px1 + px2 + px3 + px4;
    var cellSize = Math.ceil(totalWidth / 7);
    var allowedVariance = Math.floor(cellSize / 2);

    // Calculate differences from expected.
    var d0 = Math.abs(cellSize - px0);
    var d1 = Math.abs(cellSize - px1);
    var d2 = Math.abs(3 * cellSize - px2);
    var d3 = Math.abs(cellSize - px3);
    var d4 = Math.abs(cellSize - px4);

    if (
        d0 < allowedVariance &&
        d1 < allowedVariance &&
        d2 < 3 * allowedVariance &&
        d3 < allowedVariance &&
        d4 < allowedVariance
    ) {
        return 1;
    } else {
        return 0;
    }
}

/// ----------------------
/// END KERNEL DEFINITIONS
/// ----------------------

function createStandardKernel(kernelFunc, options) {
    return (mode, kernelCreator) => {
        const constants = {
            isGpuMode: mode === 'gpu' ? 1 : 0,
            width,
            height,
            PI: Math.PI,
            E: Math.E,
        };

        const kernelOpts = Object.assign({ constants }, options);
        return kernelCreator.createKernel(kernelFunc, kernelOpts);
    };
}

function initKernelCreator(name) {
    if (kernelCreators.gpu[name] || kernelCreators.cpu[name]) {
        throw Error('A kernel creator already exists with the same name: ' + name);
    }

    kernelCreators.gpu[name] = new GPU();
    kernelCreators.cpu[name] = new GPU({ mode: 'cpu' });
}

function getKernelCreator(mode, name) {
    if (!kernelCreators[mode][name]) {
        throw Error('No kernel creator exists with the name: ' + name);
    }

    return kernelCreators[mode][name];
}

function addKernel(kernelFactory, kernelCreatorName, kernelName, onlyOnGpu = false) {
    function addKernelFor(mode, kernelCreator) {
        if (!kernelCreator)
            throw Error('No kernel creator exists with the name: ' + kernelCreatorName);

        if (kernels[mode][kernelName])
            throw Error('A kernel already exists with the same name: ' + kernelName);

        kernels[mode][kernelName] = kernelFactory(mode, kernelCreator);
    }

    if (!kernelName) throw Error('Invalid kernel name: ' + kernelName);

    const gpuKernelCreator = getKernelCreator('gpu', kernelCreatorName);
    const cpuKernelCreator = getKernelCreator(onlyOnGpu ? 'gpu' : 'cpu', kernelCreatorName);

    addKernelFor('gpu', gpuKernelCreator);
    addKernelFor('cpu', cpuKernelCreator);
}

function getKernel(kernelName) {
    const mode = state.isGpuMode ? 'gpu' : 'cpu';
    const kernel = kernels[mode][kernelName];

    if (!kernel) {
        throw Error(`No such kernel on ${mode} with name: ${kernelName}`);
    }

    return kernel;
}
