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
    function(imageData, isCameraFlipped) {
        var x, y;

        // Input image data is y-inverted so we need to read from bottom up.
        y = 4 * this.constants.width * this.thread.y;

        // Optionally flip the camera if the argument is true.
        if (isCameraFlipped === 0) x = 4 * this.thread.x;
        else x = 4 * (this.constants.width - this.thread.x);

        // Use HSP color model to calculate perceived lightness.
        // @see http://alienryderflex.com/hsp.html
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
    function(A) {
        var left, mid, right;

        if (this.thread.x <= 0) left = A[this.thread.y][this.thread.x];
        else left = A[this.thread.y][this.thread.x - 1];

        mid = A[this.thread.y][this.thread.x];

        if (this.thread.x >= this.constants.width - 1) right = A[this.thread.y][this.thread.x];
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

// Kernel: Try and detect QR code markers.
// Output: 1-D array corresponding to each row/column of the image.
//         If the value is > 0, then it specifies the location of a possible marker in the row.
//
// This approximation algorithm (without knowledge of higher order CV algorithms) is adapted from
// the sample C++ code at http://aishack.in/tutorials/scanning-qr-codes-2/.
function markerDetectionKernel(A, columnWise) {
    // Keep track of the current state:
    // QR code marker has this: B > W > B > W > B (1:1:3:1:1 ratio).
    var currState = 0;

    // Keep track of pixels counted within each state.
    // Cannot instantiate dynamic array so we have to do it like this.
    var px0 = 0,
        px1 = 0,
        px2 = 0,
        px3 = 0,
        px4 = 0;

    var foundMarker = 0;

    // Iterate either row-wise or column wise.
    var bounds = this.constants.width;
    if (columnWise === 1) bounds = this.constants.height;

    // Iterate through all pixels in the current row.
    for (var i = 0; i < bounds; i++) {
        var pixel;

        // Try searching from both the left and the right of the image
        // so that we can find markers that are in the same row/column.
        var j = i;
        if (this.thread.y === 1) j = bounds - i - 1;

        // If iterating column-wise, then we get the pixel at the i-th row.
        if (columnWise === 0) pixel = A[this.thread.x][j];
        else if (columnWise === 1) pixel = A[j][this.thread.x];

        if (pixel === 0) {
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

                    // Estimated size of one cell for later computation.
                    var estimatedCellSize = totalWidth / 7;

                    // The 1st y-thread stores the actual x-coordinate.
                    if (this.thread.y === 0) {
                        // The z-thread is for determining if we are finding markers from the start
                        // or from the end, since this procedure terminates on the first marker
                        // found. We return the position of the centre of the found marker.
                        if (this.thread.z === 0) foundMarker = Math.floor(j - totalWidth / 2);
                        else if (this.thread.z === 1) foundMarker = Math.floor(j + totalWidth / 2);
                    } else {
                        // The 2nd y-thread stores the cell size.
                        foundMarker = estimatedCellSize;
                    }

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
}

const createMarkerDetectionRowWise = createStandardKernel(markerDetectionKernel, {
    output: [height, 2, 2],
    outputToTexture: true,
    functions: { checkQrMarkerRatio },
    loopMaxIterations: height,
});

const createMarkerDetectionColWise = createStandardKernel(markerDetectionKernel, {
    output: [width, 2, 2],
    outputToTexture: true,
    functions: { checkQrMarkerRatio },
    loopMaxIterations: width,
});

// Kernel: Find the first three markers.
const createMarkerDetectionTop = createStandardKernel(
    function(rows, cols) {
        // The y-thread is for finding the y-th marker.
        var foundMarkers = 0;
        var returnValue = 0;

        // Search each row.
        for (var i = 0; i < this.constants.height; i++) {
            // Search each row for markers found from both left and right.
            for (var k = 0; k < 2; k++) {
                // Get the x-coordinate of the marker found in the row.
                var row = rows[k][0][i];

                // Get the y-coordinate of the marker that was found at the column corresponding to the row.
                var col = cols[k][0][row];

                // Don't duplicate if it was found in the other direction.
                if (k === 1 && rows[0][0][i] === row && cols[0][0][row] === col) {
                    continue;
                }

                // Check if the two y-coordinates tally.
                if (row > 0 && col > 0 && col === i) {
                    // Stop if we have found the y-th marker.
                    if (foundMarkers++ === this.thread.y) {
                        if (this.thread.x === 0) returnValue = row;
                        else returnValue = col;
                        break;
                    }
                }
            }
        }

        return returnValue;
    },
    {
        output: [2, 3],
        outputToTexture: true,
        loopMaxIterations: height * 2,
    }
);

// Kernel: Calculate the corners of the QR code square.
// By convention, we refer to the 4 corners of the QR code by mX, where 1 ≤ X ≤ 4.
// Irrespective of orientation or rotation of the QR code, the markers shall be
// referenced as such, once the rotation and orientation has been resolved:
// m1 m2
// m3 m4
function calculateCornersKernel(rows, cols, markers) {
    var w = this.constants.width;
    var h = this.constants.height;

    // Minimum distance threshold between every pair of points.
    var dMinT = 30;

    // Minimum area of the quadrilateral threshold.
    var areaMinT = 70000;

    // Maximum length difference threshold between the sides of the quadrilateral.
    var dDiffMaxT = 20;

    // Decode the marker positions.
    var m1x = markers[0][0];
    var m1y = markers[0][1];
    var m2x = markers[1][0];
    var m2y = markers[1][1];
    var m3x = markers[2][0];
    var m3y = markers[2][1];

    var returnValue = -1;

    // Just return 0 if we don't have enough markers.
    if (m1x <= 0 || m1y <= 0 || m2x <= 0 || m2y <= 0 || m3x <= 0 || m3y <= 0) {
        returnValue = 0;
    } else {
        // Get the estimated cell sizes both row-wise and col-wise.
        var m1rs = rows[0][1][m1y];
        var m2rs = rows[0][1][m2y];
        var m3rs = rows[0][1][m3y];
        var m1cs = cols[0][1][m1x];
        var m2cs = cols[0][1][m2x];
        var m3cs = cols[0][1][m3x];

        // Count the average cell size both row-wise and col-wise.
        var cellSizeRowWise = (m1rs + m2rs + m3rs) / 3;
        var cellSizeColWise = (m1cs + m2cs + m3cs) / 3;

        // Calculate distances.
        var m1m3 = dist(m1x, m1y, m3x, m3y);
        var m1m2 = dist(m1x, m1y, m2x, m2y);
        var m2m3 = dist(m2x, m2y, m3x, m3y);

        // Swap markers according to the expected distance between points.
        // m1m2, m1m3 should be smaller than m2m3.
        var temp;
        if (m1m2 > m2m3 && m1m2 > m1m3) {
            // Swap m1 and m3.
            temp = m1x;
            m1x = m3x;
            m3x = temp;
            temp = m1y;
            m1y = m3y;
            m3y = temp;
        } else if (m1m3 > m1m2 && m1m3 > m2m3) {
            // Swap m1 and m2.
            temp = m1x;
            m1x = m2x;
            m2x = temp;
            temp = m1y;
            m1y = m2y;
            m2y = temp;
        }

        // Estimate the position of the 4th point.
        var m4x = m3x + (m2x - m1x);
        var m4y = m2y + (m3y - m1y);

        // Calculate the center point of the QR code, which is the middle of the m2m3 line segment.
        var mcx = (m2x + m3x) / 2;
        var mcy = (m2y + m3y) / 2;

        // Calculate the distance between each pair of points.
        var d12 = dist(m1x, m1y, m2x, m2y);
        var d13 = dist(m1x, m1y, m3x, m3y);
        var d14 = dist(m1x, m1y, m4x, m4y);
        var d23 = dist(m2x, m2y, m3x, m3y);
        var d24 = dist(m2x, m2y, m4x, m4y);
        var d34 = dist(m3x, m3y, m4x, m4y);

        // Find the upper and lower bounds of the sides of the quad.
        var lineLengthMax = max(d12, d24, d34, d13);
        var lineLengthMin = min(d12, d24, d34, d13);

        // Calculate the area of the quadrilateral.
        var area = area(m1x, m1y, m2x, m2y, m3x, m3y, m4x, m4y);

        if (min(m1x, m2x, m3x, m4x) < 0 || min(m1y, m2y, m3y, m4y) < 0 || max(m1x, m2x, m3x, m4x) > w || max(m1y, m2y, m3y, m4y) > h) {
            // Don't send any corners if any of them are out of range.
            returnValue = 0;
        } else if (d12 < dMinT || d13 < dMinT || d14 < dMinT || d23 < dMinT || d24 < dMinT || d34 < dMinT) {
            // Don't send any corners if any two of them are very close to each other.
            returnValue = 0;
        } else if (area < areaMinT) {
            // Don't send any corners if the total area is too small.
            returnValue = 0;
        } else if (lineLengthMax - lineLengthMin > dDiffMaxT) {
            // Don't send any corners if the difference in lengths is too large.
            returnValue = 0;
        }

        // Displace all points by 3.5x cell size, away from the center of the QR code.
        var displaceX = cellSizeRowWise * 3.5;
        var displaceY = cellSizeColWise * 3.5;

        if (m1x < mcx) m1x -= displaceX;
        else m1x += displaceX;
        if (m2x < mcx) m2x -= displaceX;
        else m2x += displaceX;
        if (m3x < mcx) m3x -= displaceX;
        else m3x += displaceX;
        if (m4x < mcx) m4x -= displaceX;
        else m4x += displaceX;
        if (m1y < mcy) m1y -= displaceY;
        else m1y += displaceY;
        if (m2y < mcy) m2y -= displaceY;
        else m2y += displaceY;
        if (m3y < mcy) m3y -= displaceY;
        else m3y += displaceY;
        if (m4y < mcy) m4y -= displaceY;
        else m4y += displaceY;

        // Return the points.
        if (returnValue === 0) {
            return 0;
        } else if (this.thread.y === 0) {
            if (this.thread.x === 0) return m1x;
            else return m1y;
        } else if (this.thread.y === 1) {
            if (this.thread.x === 0) return m2x;
            else return m2y;
        } else if (this.thread.y === 2) {
            if (this.thread.x === 0) return m3x;
            else return m3y;
        } else {
            if (this.thread.x === 0) return m4x;
            else return m4y;
        }
    }
}

const createCalculateCorners = createStandardKernel(calculateCornersKernel, {
    output: [2, 4],
    outputToTexture: true,
    functions: { dist, area, max, min },
});

// Output as array, not texture.
// Used when passing the array between GPU to CPU.
const createCalculateCornersAsArray = createStandardKernel(calculateCornersKernel, {
    output: [2, 4],
    outputToTexture: false,
    functions: { dist, area, max, min },
});

// Kernel: Perform affine transformation on the image to return the QR code in a square.
// We assume that the image is not _too_ warped.
const createAffineTransform = createStandardKernel(
    function(A, corners, dimension, oldTexture) {
        // Don't display anything if we don't have enough corners.
        for (var i = 0; i < 4; i++) if (corners[i][0] <= 0 || corners[i][1] <= 0) return oldTexture[this.thread.y][this.thread.x];

        // Calculate the size of each module that is to be rendered.
        var moduleSize = Math.floor(this.constants.qrCodeLength / dimension);

        // Calculate the number of pixels that is to be sampled within the source image, along both x and y axes.
        var sampleX = Math.floor(Math.abs(corners[1][0] - corners[0][0]) / dimension);
        var sampleY = Math.floor(Math.abs(corners[2][1] - corners[0][1]) / dimension);

        // Partition the pixels into `dimension` partitions.
        var px = Math.floor(this.thread.x / moduleSize) / dimension;
        var py = Math.floor(this.thread.y / moduleSize) / dimension;

        // Get the coordinates of the origin of the partition.
        var x = Math.floor(corners[0][0] + (corners[1][0] - corners[0][0]) * px + (corners[2][0] - corners[0][0]) * py);
        var y = Math.floor(corners[0][1] + (corners[2][1] - corners[0][1]) * py + (corners[3][1] - corners[2][1]) * px);

        // Take the average of all colors within the pixels in the partition.
        var sum = 0;
        for (var i = 0; i < sampleY; i++) {
            for (var j = 0; j < sampleX; j++) {
                sum += A[y + i][x + j];
            }
        }

        return Math.floor(sum / (sampleX * sampleY) + 0.5);
    },
    {
        output: [qrCodeLength, qrCodeLength],
        outputToTexture: true,
        loopMaxIterations: 1000,
    }
);

// Kernel: Draw bounding box and corners around detected QR code.
const createOutlineQrCode = createStandardKernel(
    function(A, points, pointColors) {
        // Radius of the point to draw at the corners of the bounding box.
        var r = 4;

        // Line thickness.
        var lt = 150;

        var x = this.thread.x;
        var y = this.thread.y;
        var z = this.thread.z;

        var returnValue = A[y][x];

        // Draw corners.
        for (var i = 0; i < 4; i++) {
            var px = points[i][0];
            var py = points[i][1];

            if (px > 0 && py > 0 && x > px - r && x < px + r && y > py - r && y < py + r) {
                returnValue = pointColors[i][z];
                break;
            }
        }

        if (returnValue === A[y][x]) {
            var x0 = points[0][0];
            var y0 = points[0][1];
            var x1 = points[1][0];
            var y1 = points[1][1];
            var x2 = points[2][0];
            var y2 = points[2][1];
            var x3 = points[3][0];
            var y3 = points[3][1];

            // Calculate if point lies within any of the 4 edges.
            var between01 = isOnLineSegment(x, y, x0, y0, x1, y1, lt);
            var between13 = isOnLineSegment(x, y, x1, y1, x3, y3, lt);
            var between32 = isOnLineSegment(x, y, x3, y3, x2, y2, lt);
            var between20 = isOnLineSegment(x, y, x2, y2, x0, y0, lt);

            // Draw bounding box.
            if (between01 === 1 || between13 === 1 || between32 === 1 || between20 === 1) {
                if (z === 0) returnValue = 1;
                else returnValue = 0;
            }
        }

        // Otherwise, return original image.
        return returnValue;
    },
    {
        output: [width, height, channels],
        outputToTexture: true,
        loopMaxIterations: 4,
        functions: { isOnLineSegment },
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
        var r = A[0][this.constants.height - 1 - this.thread.y][this.thread.x];
        var g = A[1][this.constants.height - 1 - this.thread.y][this.thread.x];
        var b = A[2][this.constants.height - 1 - this.thread.y][this.thread.x];

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
        var value = A[this.constants.height - 1 - this.thread.y][this.thread.x];
        this.color(value, value, value, 1);
    },
    {
        output: [width, height],
        graphical: true,
    }
);

// Kernel: Render images in greyscale.
// Input:  2-D array (1 channel)
const createRenderQrCode = createStandardKernel(
    function(A) {
        var value = A[this.constants.qrCodeLength - 1 - this.thread.y][this.thread.x];
        this.color(value, value, value, 1);
    },
    {
        output: [qrCodeLength, qrCodeLength],
        graphical: true,
    }
);

// Kernel: Return an array of black pixels the same dimensions as the QR code.
const createEmptyQrCodeTexture = createStandardKernel(
    function() {
        return 0;
    },
    {
        output: [qrCodeLength, qrCodeLength],
        outputToTexture: true,
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
    var minWidth = 14;

    // Reject if total width is less than minimum width.
    if (totalWidth < minWidth) {
        return 0;
    }

    // Calculate differences from expected.
    var d0 = Math.abs(cellSize - px0);
    var d1 = Math.abs(cellSize - px1);
    var d2 = Math.abs(3 * cellSize - px2);
    var d3 = Math.abs(cellSize - px3);
    var d4 = Math.abs(cellSize - px4);

    if (d0 < allowedVariance && d1 < allowedVariance && d2 < 3 * allowedVariance && d3 < allowedVariance && d4 < allowedVariance) {
        return 1;
    } else {
        return 0;
    }
}

// Calculates the simple Euclidean distance between two points.
// Uses Pythagoras' theorem.
function dist(x1, y1, x2, y2) {
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    return Math.sqrt(dx * dx + dy * dy);
}

// Calculates the area of a 4-gon, given the Cartesian coordinates.
function area(x1, y1, x2, y2, x3, y3, x4, y4) {
    return Math.abs(x1 * y2 - x2 * y1 + x2 * y3 - x3 * y2 + x3 * y4 + x4 * y3 + x4 * y1 - x1 * y4);
}

// Polyfill for Math.max(), restricted to exactly 4 arguments.
function max(a, b, c, d) {
    var max = a;
    if (b > a) max = b;
    if (c > a) max = c;
    if (d > a) max = d;
    return max;
}

// Polyfill for Math.min(), restricted to exactly 4 arguments.
function min(a, b, c, d) {
    var min = a;
    if (b < a) min = b;
    if (c < a) min = c;
    if (d < a) min = d;
    return min;
}

// Polyfill for Math.atan2().
// Formula: https://en.wikipedia.org/wiki/Atan2#Definition_and_computation
function atan2(y, x) {
    var angle;
    var PI = this.constants.PI;

    if (x > 0) {
        angle = Math.atan(y / x);
    } else if (x < 0) {
        if (y >= 0) {
            angle = Math.atan(y / x) + PI;
        } else {
            angle = Math.atan(y / x) - PI;
        }
    } else {
        if (y > 0) {
            angle = PI / 2;
        } else {
            angle = PI / -2;
        }
    }

    return angle;
}

// Checks if a point lies on a line segment between two other points.
function isOnLineSegment(x0, y0, x1, y1, x2, y2, radius) {
    var returnValue = 0;

    // Checks if any point is out of range.
    if (x0 > 0 && y0 > 0 && x1 > 0 && y1 > 0 && x2 > 0 && y2 > 0) {
        // Checks if the points are collinear.
        if (Math.abs(Math.abs((x1 - x0) * (y2 - y0)) - Math.abs((x2 - x0) * (y1 - y0))) < radius) {
            // Checks if the point's coordinates are within.
            if ((x1 <= x0 && x0 <= x2) || (x2 <= x0 && x0 <= x1)) {
                if ((y1 <= y0 && y0 <= y2) || (y2 <= y0 && y0 <= y1)) {
                    returnValue = 1;
                }
            }
        }
    }

    return returnValue;
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
            qrCodeLength,
            qrCodeDimension,
            squareSize: 10,
            PI: Math.PI,
            E: Math.E,
            SQRT2: Math.SQRT2,
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
        if (!kernelCreator) {
            throw Error('No kernel creator exists with the name: ' + kernelCreatorName);
        }

        if (kernels[mode][kernelName]) {
            throw Error('A kernel already exists with the same name: ' + kernelName);
        }

        kernels[mode][kernelName] = kernelFactory(mode, kernelCreator);
    }

    if (!kernelName) {
        throw Error('Invalid kernel name: ' + kernelName);
    }

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
