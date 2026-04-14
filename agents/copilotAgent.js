const { execSync } = require("child_process");
const fs = require("fs");

function getLogs() {
  try {
    return execSync("sf apex log list", { encoding: "utf-8" });
  } catch {
    return "No logs available";
  }
}

function getMetadata() {
  try {
    return JSON.parse(fs.readFileSync("manifest/metadata.json", "utf-8"));
  } catch {
    return {};
  }
}

// 🧠 SIMPLE NLP INTENT DETECTION
function detectIntent(query) {
  query = query.toLowerCase();

  if (query.includes("recent") && query.includes("apex")) return "recent_apex";
  if (query.includes("deploy")) return "deploy_help";
  if (query.includes("failure") || query.includes("error")) return "failure";
  if (query.includes("dependency")) return "dependency";
  if (query.includes("best practice")) return "best_practice";

  return "default";
}

function analyzeUserQuery(query) {
  const intent = detectIntent(query);
  const logs = getLogs();
  const metadata = getMetadata();

  let response = "";

  switch (intent) {

    // 🔥 RECENT APEX
    case "recent_apex":
      if (metadata.ApexClass && metadata.ApexClass.length > 0) {
        response += "📘 Recent Apex Classes:\n";

        metadata.ApexClass.slice(0, 5).forEach(a => {
          response += `- ${a.name} (by ${a.modifiedBy})\n`;
        });

        response += "\n💡 These are recently modified classes ready for deployment.";
      } else {
        response = "❌ No recent Apex classes found.";
      }
      break;

    // 🔥 DEPLOYMENT HELP
    case "deploy_help":
      response += "📦 Deployment Guidance:\n";
      response += "- Include test classes\n";
      response += "- Add dependent objects & fields\n";
      response += "- Validate flows and validation rules\n";
      response += "- Ensure 75% test coverage\n";
      response += "\n⚠️ Missing dependencies can cause deployment failure.";
      break;

    // 🔥 FAILURE ANALYSIS
    case "failure":
      response += "❌ Deployment Failure Insight:\n";
      response += logs.substring(0, 200);

      response += "\n\n💡 Suggested Fix:\n";
      response += "- Check failing test classes\n";
      response += "- Validate assertions\n";
      response += "- Ensure test data setup";
      break;

    // 🔥 DEPENDENCIES
    case "dependency":
      response += "🔗 Metadata Dependencies:\n";

      Object.keys(metadata).forEach(type => {
        if (metadata[type]?.length > 0) {
          response += `- ${type}: ${metadata[type].length} items\n`;
        }
      });

      response += "\n💡 Include related metadata during deployment.";
      break;

    // 🔥 BEST PRACTICES
    case "best_practice":
      response += "🧠 Salesforce Best Practices:\n";
      response += "- Use proper naming conventions\n";
      response += "- Avoid hardcoding values\n";
      response += "- Write bulk-safe code\n";
      response += "- Maintain test coverage\n";
      break;

    // 🔥 DEFAULT (SMART FALLBACK)
    default:
      response += "🤖 I can help with:\n";
      response += "- Deployment guidance\n";
      response += "- Recent metadata\n";
      response += "- Failure debugging\n";
      response += "- Dependencies\n\n";

      response += "💡 Try asking:\n";
      response += "'recent apex classes'\n";
      response += "'why deployment failed'\n";
      break;
  }

  return response;
}

module.exports = { analyzeUserQuery };