require("dotenv").config();
const connectDB = require("./config/db");
const app = require("./app");

connectDB().then(() => {
  app.listen(process.env.PORT || 5000, () => {
    console.log("Server running");
  });
});

//had to reset back to this commit 44a10dd