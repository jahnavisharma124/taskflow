
function isValidId(id) {
  return /^[1-9]\d*$/.test(String(id));
}

function validateId(req, res, next) {
  const ids = [
    req.params.id,
    req.params.userId,
    req.body?.user_id
  ].filter(value => value !== undefined);

  if (ids.some(id => !isValidId(id))) {
    return res.status(400).json({
      message: 'ID must be a positive integer'
    });
  }

  next();
}

module.exports = { isValidId, validateId };
