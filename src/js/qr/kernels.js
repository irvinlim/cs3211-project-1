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
/// END KERNEL DEFINITIONS
/// ----------------------

function createStandardKernel(kernelFunc, options) {
    return (mode, kernelCreator) => {
        const constants = {
            isGpuMode: mode === 'gpu' ? 1 : 0,
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
