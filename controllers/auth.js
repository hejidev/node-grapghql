// ================== REFACTORED WITH ASYNC/AWAIT ==================

const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");

// ================= SIGNUP =================
exports.signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error = new Error("Validation failed.");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const { email, name, password } = req.body;

    // HASH PASSWORD
    const passwordHash = await bcrypt.hash(password, 12);

    // CREATE USER
    const user = new User({
      email,
      name,
      password: passwordHash,
    });

    const result = await user.save();

    res.status(201).json({
      message: "User created!",
      userId: result._id,
    });

  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

// ================= LOGIN =================
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // FIND USER
    const user = await User.findOne({ email: email });

    if (!user) {
      const error = new Error("A user with this email could not be found.");
      error.statusCode = 401;
      throw error;
    }

    // CHECK PASSWORD
    const isEqual = await bcrypt.compare(password, user.password);

    if (!isEqual) {
      const error = new Error("Wrong password!");
      error.statusCode = 401;
      throw error;
    }

    // GENERATE TOKEN
    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id.toString(),
      },
      "somesupersecretsecret",
      { expiresIn: "1h" }
    );

    res.status(200).json({
      token: token,
      userId: user._id.toString(),
    });

  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};