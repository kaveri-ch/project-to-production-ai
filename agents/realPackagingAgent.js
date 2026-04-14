const { execSync } = require("child_process");
const jsforce = require("jsforce");
const fs = require("fs");

async function run() {
  try {
    console.log("🚀 Script started...");

    const orgInfo = JSON.parse(
      execSync("sf org display --target-org Dev --json", { encoding: "utf-8" })
    );

    const conn = new jsforce.Connection({
      instanceUrl: orgInfo.result.instanceUrl,
      accessToken: orgInfo.result.accessToken,
      version: "59.0"
    });

    console.log("✅ Connected using existing session");

    // 🔥 Apex
    const apex = await conn.tooling.query(`
      SELECT Name, LastModifiedDate, LastModifiedBy.Name
      FROM ApexClass
      WHERE LastModifiedDate = LAST_N_DAYS:180
    `);

    // 🔥 Objects
    const objects = await conn.tooling.query(`
      SELECT QualifiedApiName, LastModifiedDate, LastModifiedBy.Name
      FROM EntityDefinition
      WHERE LastModifiedDate = LAST_N_DAYS:180
      AND NamespacePrefix = null
    `);

    // 🔥 Validation Rules
    const validations = await conn.tooling.query(`
      SELECT ValidationName, LastModifiedDate, LastModifiedBy.Name
      FROM ValidationRule
      WHERE LastModifiedDate = LAST_N_DAYS:180
    `);

    const metadata = {
      ApexClass: apex.records.map(r => ({
        name: r.Name,
        lastModified: r.LastModifiedDate,
        modifiedBy: r.LastModifiedBy?.Name || "N/A"
      })),

      CustomObject: objects.records.map(r => ({
        name: r.QualifiedApiName,
        lastModified: r.LastModifiedDate,
        modifiedBy: r.LastModifiedBy?.Name || "N/A"
      })),

      ValidationRule: validations.records.map(r => ({
        name: r.ValidationName,
        lastModified: r.LastModifiedDate,
        modifiedBy: r.LastModifiedBy?.Name || "N/A"
      }))
    };

    console.log("📦 Metadata:", metadata);

    // 🔥 Generate package.xml
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n`;

    Object.keys(metadata).forEach(type => {
      if (metadata[type].length > 0) {
        xml += `  <types>\n`;
        metadata[type].forEach(item => {
          xml += `    <members>${item.name}</members>\n`;
        });
        xml += `    <name>${type}</name>\n`;
        xml += `  </types>\n`;
      }
    });

    xml += `  <version>59.0</version>\n</Package>`;

    if (!fs.existsSync("manifest")) fs.mkdirSync("manifest");

    fs.writeFileSync("manifest/package.xml", xml);
    fs.writeFileSync("manifest/metadata.json", JSON.stringify(metadata, null, 2));

    console.log("✅ package.xml generated successfully!");

  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

run();