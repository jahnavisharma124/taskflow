// Handles requests to URLs that do not exist
function notFoundHandler(req, res, next) {
  res.status(404).json({
    message: 'Route not found'
  });
}

// Handles errors from Express and route handlers
function errorHandler(err, req, res, next) {
  // Invalid JSON sent in the request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      message: 'Invalid JSON in request body'
    });
  }

  // Log the technical error in the backend terminal
  console.error(err);

  // Send a safe response without exposing internal details
  return res.status(500).json({
    message: 'Internal server error'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};