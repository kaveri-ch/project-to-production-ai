const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

app.use(express.static("public"));

/**
 * STORY AGENT
 */
app.get("/run-story", (req, res) => {
  try {
    const output = execSync("node agents/storyAgent.js", {
      encoding: "utf-8"
    });
    res.send(`<pre>${output}</pre>`);
  } catch (err) {
    res.send(`<pre>❌ Error:\n${err.message}</pre>`);
  }
});

/**
 * GENERATE PACKAGE.XML
 */
app.get("/run-package", (req, res) => {
  try {
    console.log("📦 Generating package.xml...");
    // Run agent
    execSync("node agents/realPackagingAgent.js", {
      stdio: "inherit"
    });

    const filePath = path.join(__dirname, "manifest", "package.xml");

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.send(`<pre>❌ package.xml not found</pre>`);
    }

    const xml = fs.readFileSync(filePath, "utf-8");

    // Send clean formatted XML to UI
    res.send(`
      <h3>📦 Generated package.xml</h3>
      <pre style="background:#1e1e1e;color:#00ffcc;padding:15px;border-radius:8px;">
${xml}
      </pre>
    `);

  } catch (err) {
    res.send(`<pre>❌ Error:\n${err.message}</pre>`);
  }
});

/**
 * DOWNLOAD PACKAGE.XML
 */
app.get("/download-package", (req, res) => {
  const filePath = path.join(__dirname, "manifest", "package.xml");

  if (!fs.existsSync(filePath)) {
    return res.send("❌ No package.xml found. Generate it first.");
  }

  res.download(filePath, "package.xml");
});

/**
 * FETCH METADATA DETAILS
 */
app.get("/get-metadata", (req, res) => {
  try {
    execSync("node agents/realPackagingAgent.js");

    const data = fs.readFileSync("manifest/metadata.json", "utf-8");

    res.json(JSON.parse(data));
  } catch (err) {
    res.json({ error: err.message });
  }
});


/**
 * RISK AGENT
 */
app.post("/analyze-risk", express.json(), async (req, res) => {
  try {
    const { run } = require("./agents/riskAgent");

    const result = await run(req.body);

    if (!result || result.error) {
      return res.send(`<pre>❌ ${result?.error || "Unknown error"}</pre>`);
    }

    let color = "green";
    if (result.riskLevel === "High") color = "red";
    else if (result.riskLevel === "Medium") color = "orange";

    let html = `
      <h3>⚠️ Deployment Risk Analysis</h3>
      <p><b>Risk Level:</b> <span style="color:${color};font-weight:bold">${result.riskLevel}</span></p>
      <p><b>Risk Score:</b> ${result.riskScore || 0}/100</p>
    `;

    html += "<h4>Findings:</h4><ul>";
    (result.findings || []).forEach(f => html += `<li>${f}</li>`);
    html += "</ul>";

    html += "<h4>AI Explanation:</h4><ul>";
    (result.explanations || []).forEach(e => html += `<li>${e}</li>`);
    html += "</ul>";

    res.send(html);

  } catch (err) {
    res.send(`<pre>❌ ${err.message}</pre>`);
  }
});

/**
 * DEVOPS COPILOT
 */
app.get("/run-copilot", (req, res) => {
  try {
    const output = execSync("node agents/copilotAgent.js", {
      encoding: "utf-8"
    });
    res.send(`<pre>${output}</pre>`);
  } catch (err) {
    res.send(`<pre>❌ Error:\n${err.message}</pre>`);
  }
});

app.post("/chat", express.json(), (req, res) => {
  try {
    const { analyzeUserQuery } = require("./agents/copilotAgent");

    const userQuery = req.body.message;

    const reply = analyzeUserQuery(userQuery);

    res.json({ reply });

  } catch (err) {
    res.json({ reply: "❌ Error processing request" });
  }
});

/**
 * START SERVER
 */
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});