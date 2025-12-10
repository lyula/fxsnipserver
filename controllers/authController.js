const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");

exports.register = async (req, res, next) => {
  try {
  const { name, username, email, password, country, countryCode, countryFlag, gender, dateOfBirth } = req.body;

    // Name validation
    if (!name || name.trim().length < 1) {
      return res.status(400).json({ message: "Name is required." });
    }

    // Username validation (Instagram-style)
    const usernameRegex = /^(?!.*[_.]{2})[a-zA-Z0-9](?!.*[_.]{2})[a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/;
    if (
      !username ||
      !usernameRegex.test(username) ||
      username.length < 3 ||
      username.length > 30 ||
      /^\d+$/.test(username) || // cannot be only numbers
      username.includes("@") // cannot be an email
    ) {
      return res.status(400).json({
        message:
          "Invalid username. Use 3-30 letters, numbers, underscores, or periods. Cannot be only numbers, start/end with period/underscore, or contain '@'."
      });
    }
    // Gender validation
    if (!gender || !["male", "female", "other"].includes(gender)) {
      return res.status(400).json({ message: "Gender is required and must be one of: male, female, other." });
    }
    // Date of birth validation
    if (!dateOfBirth || isNaN(Date.parse(dateOfBirth))) {
      return res.status(400).json({ message: "Valid date of birth is required." });
    }

    // Check for existing email
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already registered." });

    // Check for existing username
    const usernameExists = await User.findOne({ username });
    if (usernameExists) return res.status(409).json({ message: "Username already taken." });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      email,
      password: hash,
      gender,
      dateOfBirth: new Date(dateOfBirth),
      country,
      countryCode,
      countryFlag,
      verified: false, // <-- Explicitly set
    });
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });
    const token = generateToken({
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      country: user.country,
      countryCode: user.countryCode,
      countryFlag: user.countryFlag,
    });
    res.json({ token });
  } catch (err) {
    next(err);
  }
};