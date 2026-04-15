const { exec } = require("child_process");
const fs = require("fs");
const ORG = "Dev"; // 👈 your org alias

const METADATA_CONFIG = {
  ApexClass: {
    soql: "SELECT Name, LastModifiedDate, LastModifiedBy.Name FROM ApexClass"
  },
  ApexTrigger: {
    soql: "SELECT Name, LastModifiedDate, LastModifiedBy.Name FROM ApexTrigger"
  },
  Flow: {
    soql: "SELECT Label, LastModifiedDate, LastModifiedBy FROM FlowDefinitionView",
  },
  CustomObject: {
    soql: "SELECT QualifiedApiName, LastModifiedDate, LastModifiedBy.Name FROM EntityDefinition WHERE IsCustomizable = true"
  },
  Layout: {
    soql: "SELECT Name, LastModifiedDate, LastModifiedBy.Name FROM Layout",
    tooling: true
  },
  PermissionSet: {
    soql: "SELECT Name, LastModifiedDate, LastModifiedBy.Name FROM PermissionSet"
  },
  Profile: {
    soql: "SELECT Name, LastModifiedDate, LastModifiedBy.Name FROM Profile"
  },
  LightningComponentBundle: {
    soql: "SELECT DeveloperName, LastModifiedDate, LastModifiedBy.Name FROM LightningComponentBundle",
    tooling: true
  }
};

// 🔥 Helper to run commands async
function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 5000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Command failed:\n${cmd}`);
        console.error(stderr);
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

async function fetchType(type, config) {
  try {
  // Run CLI + SOQL in parallel
    console.log(`👉 ${type}`);

    const cliCmd = `sf org list metadata --metadata-type ${type} --target-org ${ORG} --json`;

    const soqlCmd = config.tooling
      ? `sf data query -t -q "${config.soql}" --target-org ${ORG} --json`
      : `sf data query -q "${config.soql}" --target-org ${ORG} --json`;

    const [cliOutput, soqlOutput] = await Promise.all([
      runCommand(cliCmd),
      runCommand(soqlCmd)
    ]);

    const cliData = JSON.parse(cliOutput).result || [];
    const soqlRecords = JSON.parse(soqlOutput).result?.records || [];
	
	// Build SOQL map
    const soqlMap = {};

    soqlRecords.forEach(r => {
      const name = r.Name || r.DeveloperName || r.QualifiedApiName;

      soqlMap[name] = {
        lastModified: r.LastModifiedDate,
        modifiedBy: r.LastModifiedBy?.Name || "Unknown"
      };
    });
    // Merge
    return cliData.map(c => ({
      name: c.fullName,
      type,
      lastModified: soqlMap[c.fullName]?.lastModified || null,
      modifiedBy: soqlMap[c.fullName]?.modifiedBy || "Unknown"
    }));

  } catch (err) {
    console.error(`❌ Failed ${type}`);
    return [];
  }
}

async function run() {
  console.log("🚀 Parallel metadata fetch started...");

  const promises = Object.entries(METADATA_CONFIG).map(([type, config]) =>
    fetchType(type, config)
  );

  const results = await Promise.all(promises);

  const finalList = results.flat();

  // Deduplicate
  const unique = {};
  finalList.forEach(m => {
    unique[`${m.type}-${m.name}`] = m;
  });

  const cleaned = Object.values(unique);

  // Sort
  cleaned.sort((a, b) =>
    new Date(b.lastModified || 0) - new Date(a.lastModified || 0)
  );

  if (!fs.existsSync("manifest")) fs.mkdirSync("manifest");

  fs.writeFileSync(
    "manifest/metadata.json",
    JSON.stringify(cleaned, null, 2)
  );

  console.log("✅ metadata.json generated");
}

run();