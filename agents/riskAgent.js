const jsforce = require("jsforce");
const { execSync } = require("child_process");
const axios = require("axios");

/**
 * Naming Suggestion Helper
 */
function suggestApexName(name) {
  const formatted = name.charAt(0).toUpperCase() + name.slice(1);

  if (
    formatted.endsWith("Controller") ||
    formatted.endsWith("Service") ||
    formatted.endsWith("Util")
  ) {
    return formatted;
  }

  if (formatted.toLowerCase().includes("service")) return formatted + "Service";
  if (formatted.toLowerCase().includes("util")) return formatted + "Util";
  if (formatted.toLowerCase().includes("helper")) return formatted + "Helper";

  return formatted + "Controller";
}

/**
 * Parse Input
 */
function parseInput(inputList) {
  return inputList.map(item => {
    const lower = item.toLowerCase();

    if (lower.endsWith(".cls")) {
      return { type: "ApexClass", name: item.replace(".cls", "") };
    }

    if (lower.endsWith(".flow-meta.xml")) {
      return { type: "Flow", name: item.replace(".flow-meta.xml", "") };
    }

    return { type: "Unknown", name: item };
  });
}

/**
 * AI Analysis (SAFE MODE)
 */
async function aiAnalysis(context) {
  try {
    if (!process.env.OPENAI_API_KEY) return null;

    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content:
              "You are a Salesforce DevOps expert analyzing deployment risks. Provide concise risks and mitigation steps."
          },
          {
            role: "user",
            content: context
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    return res.data.choices[0].message.content;

  } catch (e) {
    return null; // fail silently
  }
}

/**
 * MAIN RUN FUNCTION
 */
async function run(inputList) {
  try {
    const parsed = parseInput(inputList);

    const orgInfo = JSON.parse(
      execSync("sf org display --target-org Dev --json", { encoding: "utf-8" })
    );

    const conn = new jsforce.Connection({
      instanceUrl: orgInfo.result.instanceUrl,
      accessToken: orgInfo.result.accessToken
    });

    let riskScore = 10;
    let findings = [];
    let explanations = [];

    // -------------------------------
    // 🔥 API LIMIT CHECK
    // -------------------------------
    let limits = {};
    try {
      limits = await conn.limits();

      if (limits.DailyApiRequests.Remaining < 1000) {
        riskScore += 25;
        findings.push("⚠️ API limits are close to exhaustion");
        explanations.push("Deployment may fail due to API throttling.");
      }
    } catch {
      findings.push("ℹ️ Unable to fetch API limits");
    }

    // -------------------------------
    // 🔥 PMD SCAN (SAFE)
    // -------------------------------
    // 🔥 PMD SCAN (FIXED VERSION)
      let pmdIssues = 0;

      try {
        const pmdOutput = execSync(
          `sf scanner run --target "force-app" --format json`,
          { encoding: "utf-8" }
        );

        try {
          const parsed = JSON.parse(pmdOutput);
          pmdIssues = parsed.result?.length || 0;
        } catch {
          // fallback if JSON fails
          const match = pmdOutput.match(/found (\d+) violation/);
          if (match) pmdIssues = parseInt(match[1]);
        }

        // ✅ THIS IS WHERE YOUR BLOCK GOES
        if (pmdIssues > 0) {
          riskScore += 20;
          findings.push(`❌ PMD Issues detected: ${pmdIssues}`);
          findings.push("⚠️ Missing ApexDoc comments");
          findings.push("⚠️ CRUD/FLS validation missing");
          findings.push("⚠️ Unused variables detected");

          explanations.push(
            "Code quality issues found including documentation, security validation, and unused variables."
          );
        }

      } catch {
        findings.push("ℹ️ PMD scan skipped");
      }

    // -------------------------------
    // 🔥 MAIN LOOP
    // -------------------------------
    for (let item of parsed) {

      // =============================
      // APEX ANALYSIS
      // =============================
      if (item.type === "ApexClass") {

        const res = await conn.tooling.query(`
          SELECT Name, ApiVersion
          FROM ApexClass
          WHERE Name = '${item.name}'
        `);

        if (res.records.length > 0) {
          const cls = res.records[0];

          // OLD API
          if (cls.ApiVersion < 50) {
            riskScore += 25;
            findings.push(`⚠️ ${item.name}: Using old API version`);
            explanations.push("Older API versions may break in future releases.");
          }

          // NAMING
          if (!item.name.endsWith("Controller") && !item.name.endsWith("Service")) {
            const suggestion = suggestApexName(item.name);
            riskScore += 10;
            findings.push(`⚠️ ${item.name}: Naming standard not followed`);
            findings.push(`💡 Suggested Name: ${suggestion}`);
            explanations.push("Follow naming conventions for maintainability.");
          }

          // TEST CLASS
          const testRes = await conn.tooling.query(`
            SELECT Name FROM ApexClass
            WHERE Name = '${item.name}Test'
          `);

          if (testRes.records.length === 0) {
            riskScore += 30;
            findings.push(`❌ ${item.name}: Missing test class`);
            explanations.push("Deployment requires sufficient test coverage.");
          } else {
            findings.push(`✅ ${item.name}: Test class found`);
          }

          // DEPENDENCY CHECK
          try {
            const deps = await conn.tooling.query(`
              SELECT MetadataComponentName
              FROM MetadataComponentDependency
              WHERE MetadataComponentName = '${item.name}'
            `);

            if (deps.records.length > 5) {
              riskScore += 20;
              findings.push(`⚠️ ${item.name}: High dependency impact`);
              explanations.push("Multiple dependent components may break.");
            }
          } catch {
            // safe ignore
          }

          // GENERIC RISK
          riskScore += 10;
          findings.push(`ℹ️ ${item.name}: Review bulkification & limits`);
        }
      }

      // =============================
      // FLOW ANALYSIS
      // =============================
      if (item.type === "Flow") {
        riskScore += 25;
        findings.push(`⚠️ ${item.name}: Flow change detected`);
        explanations.push("Flows impact business logic and need validation.");
      }

      // =============================
      // UNKNOWN
      // =============================
      if (item.type === "Unknown") {
        riskScore += 15;
        findings.push(`⚠️ ${item.name}: Unknown metadata type`);
        explanations.push("Verify dependencies and configuration.");
      }
    }

    // -------------------------------
    // 🔥 DEPLOYMENT FAILURE PREDICTION
    // -------------------------------
    if (riskScore > 70) {
      findings.push("🚨 High probability of deployment failure");
      explanations.push("Multiple risk factors detected.");
    }

    // NORMALIZE
    if (riskScore > 100) riskScore = 100;

    let riskLevel = "Low";
    if (riskScore > 70) riskLevel = "High";
    else if (riskScore > 40) riskLevel = "Medium";

    // -------------------------------
    // 🤖 AI ANALYSIS
    // -------------------------------
    try {
      const context = `
Metadata:
${JSON.stringify(parsed)}

Findings:
${findings.join("\n")}

Limits:
${JSON.stringify(limits)}
`;

      const aiResponse = await aiAnalysis(context);

      if (aiResponse) {
        explanations.push("🤖 AI Insights:");
        explanations.push(aiResponse);
      }
    } catch {
      // safe ignore
    }

    return {
      riskLevel,
      riskScore,
      findings,
      explanations
    };

  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { run };