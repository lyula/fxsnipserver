const express = require("express");
const cors = require("cors"); // <-- add this
const app = express();
const authRoutes = require("./routes/auth");
const errorHandler = require("./middleware/errorHandler");

app.use(cors()); // <-- add this line
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use(errorHandler);

module.exports = app;