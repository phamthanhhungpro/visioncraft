const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3501;

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));


app.use(cors());

// Proxy route to fetch images and bypass CORS
app.get("/proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    logToFile(`Bad request: Missing URL parameter`, 'ERROR');
    return res.status(400).send("URL is required");
  }

  try {
    logToFile(`Proxying request for: ${url}`);
    const response = await axios.get(url, { responseType: "arraybuffer" });
    res.setHeader("Content-Type", response.headers["content-type"]);
    res.send(response.data);
  } catch (error) {
    logToFile(`Error fetching image: ${error.message}`, 'ERROR');
    console.error("Error fetching the image:", error.message);
    res.status(500).send("Failed to fetch the image");
  }
});
// API Endpoint
app.post("/api/generate", async (req, res) => {
  const prompt = req.body.prompt;

  if (!prompt) {
    logToFile(`Bad request: Missing prompt`, 'ERROR');
    return res.status(400).send({ error: "Prompt is required" });
  }

  try {
    logToFile(`Generating image for prompt: ${prompt}`);
    const response = await axios.post(
      "https://api.blackbox.ai/api/chat",
      {
        messages: [
          {
            id: "unique-id",
            content: prompt,
            role: "user",
          },
        ],
        id: "unique-id",
        agentMode: {
          mode: true,
          id: "ImageGenerationLV45LJp",
          name: "Image Generation",
        },
        maxTokens: 1024,
      },
      {
        headers: {
          "Content-Type": "application/json",
          //Cookie: "sessionId=your-session-id; other-cookies=values;",
        },
      }
    );

    const imageMarkdown = response.data; // Assuming response is in Markdown format
    const imageUrl = imageMarkdown.match(/\((https?:\/\/[^\)]+)\)/)?.[1]; // Extract URL from Markdown

    if (imageUrl) {
      logToFile(`Successfully generated image: ${imageUrl}`);
      res.status(200).send({ imageUrl });
    } else {
      logToFile(`Failed to parse image URL from response`, 'ERROR');
      res.status(500).send({ error: "Failed to parse image URL" });
    }
  } catch (error) {
    logToFile(`API Error: ${error.message}`, 'ERROR');
    console.error("Error communicating with Blackbox API:", error.message);
    res.status(500).send({ error: "Failed to communicate with Blackbox API" });
  }
});

// API Endpoint to get recent logs
app.get("/api/logs", (req, res) => {
  try {
    const logs = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '')
      .reverse()
      .slice(0, 100);
    
    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error reading logs:", error.message);
    res.status(500).json({ error: "Failed to read logs" });
  }
});

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  logToFile(`Server started on port ${PORT}`);
  console.log(`Server is running at http://localhost:${PORT}`);
});



const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, './logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'app.log');

function logToFile(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${message}\n`;
    
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}
