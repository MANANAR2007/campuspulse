import User from '../models/User.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../utils/token.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new student account
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, department } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name is required and must be at least 2 characters long.',
      });
    }

    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide a valid campus email address.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password cannot exceed 128 characters.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check for existing duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        status: 'fail',
        message: 'An account with this email address already exists.',
      });
    }

    // 3. Hash password and save (Always enforce student role)
    const passwordHash = await User.hashPassword(password);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'student', // Never trust role from client body
      department: department ? department.trim() : '',
    });

    // 4. Generate JWT & Set HttpOnly cookie
    const token = generateToken(newUser);
    setAuthCookie(res, token);

    // 5. Respond with safe user object
    res.status(201).json({
      status: 'success',
      message: 'Student account registered successfully.',
      user: newUser.toJSON(),
    });
  } catch (error) {
    // Handle MongoDB duplicate key error gracefully
    if (error.code === 11000) {
      return res.status(409).json({
        status: 'fail',
        message: 'An account with this email address already exists.',
      });
    }
    next(error);
  }
};

/**
 * Login user and issue JWT cookie
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide both email address and password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Lookup user including passwordHash
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password.',
      });
    }

    // 3. Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password.',
      });
    }

    // 4. Issue JWT and set HttpOnly cookie
    const token = generateToken(user);
    setAuthCookie(res, token);

    // 5. Return safe user representation
    res.status(200).json({
      status: 'success',
      message: 'Signed in successfully.',
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user and clear authentication cookie
 * POST /api/auth/logout
 */
export const logout = (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  });
};

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
export const getMe = (req, res) => {
  // req.user is set by the authenticate middleware
  res.status(200).json({
    status: 'success',
    user: req.user.toJSON(),
  });
};

/**
 * Admin check endpoint (used to verify admin authorization)
 * GET /api/auth/admin-check
 */
export const adminCheck = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Admin authorization confirmed.',
    user: req.user.toJSON(),
  });
};
