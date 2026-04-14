const jsforce = require("jsforce");
const { execSync } = require("child_process");

function suggestApexName(name) {

  // Capitalize first letter
  const formatted = name.charAt(0).toUpperCase() + name.slice(1);

  // Already valid names → keep as is
  if (
    formatted.endsWith("Controller") ||
    formatted.endsWith("Service") ||
    formatted.endsWith("Util")
  ) {
    return formatted;
  }

  // 🔥 Smart detection logic
  if (formatted.toLowerCase().includes("service")) {
    return formatted + "Service";
  }

  if (formatted.toLowerCase().includes("util")) {
    return formatted + "Util";
  }

  if (formatted.toLowerCase().includes("helper")) {
    return formatted + "Helper";
  }

  // Default fallback
  return formatted + "Controller";
}

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

    for (let item of parsed) {

      // 🔥 APEX ANALYSIS
      if (item.type === "ApexClass") {

        const res = await conn.tooling.query(`
          SELECT Name, ApiVersion
          FROM ApexClass
          WHERE Name = '${item.name}'
        `);

        if (res.records.length > 0) {
          const cls = res.records[0];

          // 🔴 OLD API
          if (cls.ApiVersion < 50) {
            riskScore += 25;
            findings.push(`⚠️ ${item.name}: Using old API version`);
            explanations.push(`Older API versions may break in future Salesforce releases.`);
          }

          // 🔴 NAMING STANDARD
            if (!item.name.endsWith("Controller") && !item.name.endsWith("Service")) {
            const suggestion = suggestApexName(item.name);
            riskScore += 10;
            findings.push(`⚠️ ${item.name}: Naming standard not followed`);
            findings.push(`💡 Suggested Name: ${suggestion}`);
            explanations.push(`Following naming conventions improves readability and maintainability.`);
            }

          // 🔴 TEST CLASS CHECK
          const testRes = await conn.tooling.query(`
            SELECT Name FROM ApexClass
            WHERE Name = '${item.name}Test'
          `);

          if (testRes.records.length === 0) {
            riskScore += 30;
            findings.push(`❌ ${item.name}: Missing test class`);
            explanations.push(`Deployment to higher orgs requires test coverage.`);
          } else {
            findings.push(`✅ ${item.name}: Test class found`);
          }

          // 🔴 GENERIC CODE SMELL
          riskScore += 10;
          findings.push(`ℹ️ ${item.name}: Review bulkification & limits`);
          explanations.push(`Ensure class handles bulk operations and governor limits.`);
        }
      }

      // 🔥 FLOW ANALYSIS
      if (item.type === "Flow") {
        riskScore += 25;
        findings.push(`⚠️ ${item.name}: Flow change detected`);
        explanations.push(`Flows impact business logic and require manual validation.`);
      }

      // 🔥 UNKNOWN TYPE
      if (item.type === "Unknown") {
        riskScore += 15;
        findings.push(`⚠️ ${item.name}: Unknown metadata type`);
        explanations.push(`Ensure dependencies and configurations are correct.`);
      }
    }

    // 🔥 NORMALIZE SCORE
    if (riskScore > 100) riskScore = 100;

    let riskLevel = "Low";
    if (riskScore > 70) riskLevel = "High";
    else if (riskScore > 40) riskLevel = "Medium";

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