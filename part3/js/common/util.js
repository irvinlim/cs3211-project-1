// Computes the 2D Gaussian function.
function gaussianFunction(x, y, sigma) {
    var stdDev = sigma * sigma;
    var LHS = 1 / (2 * Math.PI * stdDev);
    var RHS = Math.pow(Math.E, -1 * (x * x + y * y) / (2 * stdDev));
    return LHS * RHS;
}
