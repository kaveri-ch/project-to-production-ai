const { execSync } = require("child_process");

function getChangedMetadata() {
  try {
    // Get local project changes (tracked by Salesforce)
    const output = execSync("sf project deploy preview --json", {
      encoding: "utf-8"
    });

    const data = JSON.parse(output);

    const metadata = {
      apexClasses: [],
      customFields: [],
      flows: []
    };

    const components = data?.result?.details?.componentSuccesses || [];

    components.forEach(item => {
      if (item.componentType === "ApexClass") {
        metadata.apexClasses.push(item.fullName);
      }
      if (item.componentType === "CustomField") {
        metadata.customFields.push(item.fullName);
      }
      if (item.componentType === "Flow") {
        metadata.flows.push(item.fullName);
      }
    });

    return metadata;

  } catch (err) {
    console.error("Metadata detection failed:", err.message);
    return {
      apexClasses: [],
      customFields: [],
      flows: []
    };
  }
}

module.exports = { getChangedMetadata };