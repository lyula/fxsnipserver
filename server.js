require("dotenv").config();
const { server } = require("./socket");
const connectDB = require("./config/db");

connectDB().then(() => {
  server.listen(process.env.PORT || 5000, () => {
    console.log("Server running");
  });
});
