const fs = require("fs");

const userStory = fs.readFileSync("demo/sampleUserStory.txt", "utf-8");

console.log("\n=== AI GENERATED METADATA (MOCK) ===\n");

const metadata = {
  apexClasses: ["DiscountApprovalController"],
  customFields: ["Opportunity.Discount__c", "Opportunity.Approval_Status__c"],
  flows: ["Discount_Approval_Flow"]
};

console.log(metadata);

// Save output for next agent
fs.writeFileSync("scripts/metadata.json", JSON.stringify(metadata, null, 2));