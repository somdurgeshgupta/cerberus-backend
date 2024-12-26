// error-handler.js

// Middleware function to handle errors
function errorHandler(err, req, res, next) {
    console.error(err.stack); // Log the error stack trace

    // Set HTTP status code based on the type of error
    const statusCode = err.statusCode || 500;

    // Set the response JSON object with an error message
    const responseBody = {
        error: {
            message: err.message || 'Internal Server Error'
        }
    };

    // Send the response with the appropriate status code and JSON body
    res.status(statusCode).json(responseBody);
}

// Export the errorHandler middleware function
module.exports = errorHandler;
