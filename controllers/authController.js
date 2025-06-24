const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");

exports.register = async (req, res, next) => {
  try {
    const { username, email, password, country, countryCode, countryFlag } = req.body;
    if (!username || !email || !password || !country) {
      return res.status(400).json({ message: "All fields are required." });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already registered." });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hash, country, countryCode, countryFlag });
    // Create follow management entry
    await Follow.create({
      user: user._id,
      followers: [],
      following: [],
      followersCount: 0,
      followingCount: 0,
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