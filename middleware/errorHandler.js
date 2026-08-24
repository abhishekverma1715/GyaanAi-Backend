const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
};

const errorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') return res.status(422).json({ message: Object.values(err.errors).map(e=>e.message).join(', ') });
  if (err.name === 'CastError')       return res.status(400).json({ message: 'Invalid ID format' });
  if (err.code === 11000)             return res.status(409).json({ message: `${Object.keys(err.keyValue)[0]} already exists` });
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
};

module.exports = { notFound, errorHandler };
