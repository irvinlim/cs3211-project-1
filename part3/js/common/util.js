// Computes the 2D Gaussian function.
function gaussianFunction(x, y, sigma) {
    var stdDev = sigma * sigma;
    var LHS = 1 / (2 * Math.PI * stdDev);
    var RHS = Math.pow(Math.E, -1 * (x * x + y * y) / (2 * stdDev));
    return LHS * RHS;
}

// Utility to time the invocation of a lambda function.
function timeThis(lambda) {
    const start = performance.now();
    const returnValue = lambda();
    const end = performance.now();
    return { time: end - start, returnValue };
}

// Utility to fetch a kernel, while timing the runtime of each invocation.
const getKernelTimed = (function() {
    const timings = {};
    const MAX_NUM_TIMINGS = 200;

    return function(kernelName) {
        const kernel = getKernel(kernelName);

        // Create timing array for the kernel if doesn't exist.
        if (!timings[kernelName]) timings[kernelName] = [];
        const kernelTimings = timings[kernelName];

        return function() {
            const { time, returnValue } = timeThis(() => kernel.apply(null, arguments));
            kernelTimings.push(time);

            if (kernelTimings.length >= MAX_NUM_TIMINGS) {
                const avg = kernelTimings.reduce((sum, t) => sum + t) / MAX_NUM_TIMINGS;
                console.log(`Average runtime of ${kernelName} (avg of ${MAX_NUM_TIMINGS} runs) is ${avg} ms.`);
                timings[kernelName] = [];
            }

            return returnValue;
        };
    };
})();
