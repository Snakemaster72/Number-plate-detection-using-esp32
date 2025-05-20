const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");
const app = express();
const port = 3000;
let shouldRetake = false;
const axios = require("axios");
const FormData = require("form-data");

const API_KEY = "BM2tr0dOK8jj"; // Replace with your actual API key

// Setup for receiving images
const upload = multer({ dest: "uploads/" });

// Serve frontend
app.use(express.json());

const cors = require("cors");
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(cors());

app.post("/upload", (req, res) => {
  const filePath = path.join(__dirname, "latest.jpg");
  const writeStream = fs.createWriteStream(filePath);

  req.pipe(writeStream);

  req.on("end", () => {
    console.log("Image received.");
    res.send("Image uploaded");
  });

  req.on("error", (err) => {
    console.error("Error receiving image:", err);
    res.status(500).send("Error saving image");
  });
});
// Receive image from ESP32

app.post("/process", async (req, res) => {
  const pythonPath = path.join(
    __dirname,
    "yolov3-from-opencv-object-detection",
    "venv",
    "bin",
    "python"
  );
  const scriptPath = path.join(
    __dirname,
    "yolov3-from-opencv-object-detection",
    "process.py"
  );

  const python = spawn(pythonPath, [scriptPath, "latest.jpg"]);

  let output = "";

  python.stdout.on("data", (data) => {
    output += data.toString();
    console.log("Python Output:", data.toString());
  });

  python.stderr.on("data", (data) => {
    console.error(`stderr: ${data}`);
  });

  python.on("close", (code) => {
    try {
      if (code !== 0) {
        console.error("Python script exited with error.");
        return res.status(500).json({ error: "Processing failed" });
      }

      const trimmedOutput = output.trim();
      if (!trimmedOutput) {
        return res
          .status(500)
          .json({ error: "No valid output received from Python" });
      }

      const lines = trimmedOutput.split("\n");
      const jsonLine = lines.reverse().find((line) => {
        try {
          const parsed = JSON.parse(line);
          return typeof parsed === "object" && parsed !== null;
        } catch {
          return false;
        }
      });

      if (!jsonLine) {
        console.error("No valid JSON line found in output.");
        return res.status(500).json({ error: "Invalid JSON from Python" });
      }

      let parsedOutput;
      try {
        parsedOutput = JSON.parse(jsonLine);
      } catch (err) {
        console.error("JSON Parsing Error:", err);
        console.error("Raw Output:", trimmedOutput);
        return res.status(500).json({ error: "Invalid JSON from Python" });
      }

      if (parsedOutput.status === "error") {
        return res.status(500).json({ error: parsedOutput.message });
      }

      // Save to log
      const logFile = "log.json";
      let logData = [];

      if (fs.existsSync(logFile)) {
        try {
          const fileContent = fs.readFileSync(logFile, "utf8").trim();
          logData = fileContent ? JSON.parse(fileContent) : [];
        } catch (err) {
          console.error("Error reading log.json:", err);
          logData = []; // fallback
        }
      }

      logData.push(parsedOutput);
      fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));

      console.log("Sending 200 with JSON:", parsedOutput);
      res.json(parsedOutput);
    } catch (err) {
      console.error("Unexpected Error:", err, "Raw Output:", output);
      res.status(500).json({ error: "Internal Server Error", raw: output });
    }
  });
});

// Run image processing
// app.post("/process", async (req, res) => {
//   const pythonPath = path.join(
//     __dirname,
//     "yolov3-from-opencv-object-detection",
//     "venv",
//     "Scripts",
//     "python.exe"
//   );
//   const scriptPath = path.join(
//     __dirname,
//     "yolov3-from-opencv-object-detection",
//     "process.py"
//   );
//   const python = spawn(pythonPath, [scriptPath, "latest.jpg"]);

//   let output = "";
//   python.stdout.on("data", (data) => {
//     output += data.toString();
//     console.log("Python Output:", output); // Debugging line
//   });
//   python.stderr.on("data", (data) => console.error(`stderr: ${data}`));

//   python.on("close", (code) => {
//     try {
//       if (code !== 0) {
//         console.error("Python script exited with error.");
//         return res.status(500).json({ error: "Processing failed" });
//       }

//       console.log("Raw Python Output:", output.trim()); // Debugging line

//       if (!output.trim()) {
//         return res
//           .status(500)
//           .json({ error: "No valid output received from Python" });
//       }

//       const lines = data.toString().trim().split("\n");
//       const lastLine = lines[lines.length - 1];
//       let parsedOutput;
//       try {
//         parsedOutput = JSON.parse(lastLine);
//         // now jsonOutput contains only the JSON part
//       } catch (err) {
//         console.error("JSON Parsing Error:", err);
//         console.error("Raw Output:", data.toString());
//         return;
//       }

//       if (parsedOutput.status === "error") {
//         return res.status(500).json({ error: parsedOutput.message });
//       }

//       // Save to log
//       const logFile = "log.json";
//       let logData = [];

//       if (fs.existsSync(logFile)) {
//         try {
//           const fileContent = fs.readFileSync(logFile, "utf8").trim();
//           logData = fileContent ? JSON.parse(fileContent) : [];
//         } catch (err) {
//           console.error("Error reading log.json:", err);
//           logData = []; // Prevent crash if file is corrupt
//         }
//       }

//       logData.push(parsedOutput);
//       fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));

//       res.json(parsedOutput);
//     } catch (err) {
//       console.error(
//         "JSON Parsing Error:",
//         err,
//         "Raw Output:",
//         JSON.stringify(output)
//       );
//       res.status(500).json({ error: "Invalid JSON from Python" });
//     }
//   });
// });

// app.post("/process", async (req, res) => {
//   if (!fs.existsSync("latest.jpg")) {
//     return res.status(400).json({ error: "No image uploaded yet" });
//   }
//   try {
//     // Call your Flask API to process latest.jpg
//     const flaskResponse = await axios.get(" http://192.168.1.33:5000/process");

//     const result = flaskResponse.data;

//     // Optional: check response structure
//     if (!result || !result.text) {
//       return res.status(500).json({ error: "No license plate detected" });
//     }

//     // Save to log
//     const logFile = "log.json";
//     let data = [];

//     if (fs.existsSync(logFile)) {
//       try {
//         const fileContent = fs.readFileSync(logFile, "utf8").trim();
//         data = fileContent ? JSON.parse(fileContent) : [];
//       } catch (err) {
//         console.error("Error reading log.json:", err);
//         data = []; // fallback
//       }
//     }

//     data.push(result);
//     fs.writeFileSync(logFile, JSON.stringify(data, null, 2));

//     console.log("Detection successful:", result);
//     res.json(result);
//   } catch (error) {
//     console.error(
//       "Error communicating with Flask API:",
//       error.message || error
//     );
//     res.status(500).json({ error: "Processing failed" });
//   }
// });
// At the top of server.js

// Route called from frontend
app.post("/retake", (req, res) => {
  shouldRetake = true;
  console.log("Retake requested by frontend");
  res.json({ message: "Retake command registered" });
});

// ESP32 calls this route to check if it should retake
app.get("/should-retake", (req, res) => {
  if (shouldRetake) {
    shouldRetake = false; // reset after reading
    return res.json({ retake: true });
  } else {
    return res.json({ retake: false });
  }
});

// Get current image and logs
app.get("/current-image", (req, res) => {
  const imagePath = path.join(__dirname, "latest.jpg");
  if (!fs.existsSync(imagePath)) return res.status(404).send("No image");
  res.sendFile(imagePath);
});

app.get("/logs", (req, res) => {
  const logFile = "log.json";

  if (!fs.existsSync(logFile)) {
    return res.json([]); // Send empty array if file doesn't exist
  }

  try {
    const fileContent = fs.readFileSync(logFile, "utf8").trim();
    const data = fileContent ? JSON.parse(fileContent) : [];
    res.json(data);
  } catch (err) {
    console.error("Error reading log.json:", err);
    res.status(500).json({ error: "Failed to read log file" });
  }
});

app.listen(port, "192.168.154.66", () => {
  console.log(`Server running on http://localhost:${port}`);
});
