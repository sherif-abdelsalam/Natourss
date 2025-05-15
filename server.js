require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const DB = process.env.DATABASE;
mongoose
    .connect(DB)
    .then(() => {
        console.log("DB connection successful!");
    });

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.log(`App running on port ${port}...`);
});


// listen for unhandled promise rejections and uncaught exceptions
// This is for handling errors that are not caught by the application
process.on("unhandledRejection", (err) => {
    console.log(err.name, "== " + err.message);
    console.log("Shutting down the server.......");

    // Close server and exit process safely
    server.close(() => {
        process.exit();
    });
});

// listen for uncaught exceptions
process.on("uncaughtException", (err) => {
    console.log(err.name, "== " + err.message);
    console.log("Shutting down the server.......");

    // Close server and exit process safely
    server.close(() => {
        process.exit();
    });
});

