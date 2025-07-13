function errorHandler(err, req, res, next) {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;

    const responseBody = {
        error: {
            message: err.message || 'Internal Server Error'
        }
    };

    res.status(statusCode).json(responseBody);
}

module.exports = errorHandler;
