// Koi bhi error yahin aakar handle hota hai
export function errorHandler(err, req, res, next) {
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || err?.error?.description || 'Server error';
  console.error('Request failed:', message);
  res.status(status).json({ error: status === 500 ? 'Server error' : message });
}

// Controller ko try/catch se bachata hai
export const asyncHandler = fn => (req, res, next) => fn(req, res, next).catch(next);

export const httpError = (status, message) => Object.assign(new Error(message), { status });
