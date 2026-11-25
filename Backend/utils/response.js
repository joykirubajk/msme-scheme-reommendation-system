// Consistent response shape: { success, message?, data? }

export const ok = (res, data, message, status = 200) => {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
};

export const fail = (res, status, message, errors) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
};
