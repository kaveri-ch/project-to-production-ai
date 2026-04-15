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
const { exec } = require("child_process");

app.get("/metadata-grid", async (req, res) => {
  try {
    console.log("📊 Metadata request received");

    await new Promise((resolve, reject) => {
      exec("node agents/realPackagingAgent.js", (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Agent error:", err);
          return reject(err);
        }
        console.log(stdout);
        resolve();
      });
    });

    const data = fs.readFileSync("manifest/metadata.json", "utf-8");

    res.json(JSON.parse(data));

  } catch (err) {
    console.error("❌ API error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.post("/generate-selected", express.json(), (req, res) => {
  try {
    const selected = req.body;

    let xml = `<?xml version="1.0"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n`;

    const grouped = {};

    selected.forEach(item => {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item.name);
    });

    Object.keys(grouped).forEach(type => {
      xml += `<types>\n`;
      grouped[type].forEach(n => {
        xml += `<members>${n}</members>\n`;
      });
      xml += `<name>${type}</name>\n</types>\n`;
    });

    xml += `<version>59.0</version>\n</Package>`;

    fs.writeFileSync("manifest/package.xml", xml);

    res.download("manifest/package.xml");

  } catch (err) {
    res.send(err.message);
  }
});

app.get("/generate-last-5-days", async (req, res) => {
  try {
    const data = JSON.parse(
      fs.readFileSync("manifest/metadata.json", "utf-8")
    );

    const now = new Date();

    const filtered = data.filter(item => {
      if (!item.lastModified) return false;

      const diff =
        (now - new Date(item.lastModified)) / (1000 * 60 * 60 * 24);

      return diff <= 5;
    });

    // Build package.xml
    let xml = `<?xml version="1.0"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n`;

    const grouped = {};

    filtered.forEach(item => {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item.name);
    });

    Object.keys(grouped).forEach(type => {
      xml += `<types>\n`;
      grouped[type].forEach(n => {
        xml += `<members>${n}</members>\n`;
      });
      xml += `<name>${type}</name>\n</types>\n`;
    });

    xml += `<version>59.0</version>\n</Package>`;

    fs.writeFileSync("manifest/package.xml", xml);

    res.download("manifest/package.xml");

  } catch (err) {
    res.send("❌ Error generating package");
  }
});

app.get("/org-info", (req, res) => {
  try {
    const output = execSync("sf org display --target-org Dev --json", { encoding: "utf-8" });

    const data = JSON.parse(output);

    const orgName =
      data.result.alias ||
      data.result.username ||
      data.result.orgId ||
      "Unknown Org";

    res.json({ orgName });

  } catch (err) {
    console.error(err.message);
    res.json({ orgName: "Not Connected" });
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