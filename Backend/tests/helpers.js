import jwt from 'jsonwebtoken';

// Valid JWT for protected-route tests (middleware only verifies the signature).
export const authHeader = (id = 1) => ({
  Authorization: `Bearer ${jwt.sign({ id, email: `u${id}@example.com` }, process.env.JWT_SECRET)}`,
});

export const validProfile = {
  age: 30, gender: 'male', business_category: 'manufacturing', investment: 100000, state: 'tamil_nadu',
};
