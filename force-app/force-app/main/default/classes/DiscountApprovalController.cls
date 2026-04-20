public with sharing class DiscountApprovalController {

    @AuraEnabled
    public static void submitForApproval(Id oppId) {
        Opportunity opp = [SELECT Id, Discount__c FROM Opportunity WHERE Id = :oppId LIMIT 1];
        
        if (opp.Discount__c > 20) {
            Approval.ProcessSubmitRequest req = new Approval.ProcessSubmitRequest();
            req.setObjectId(oppId);
            req.setComments('Submitting for discount approval');
            
            Approval.ProcessResult result = Approval.process(req);
        }
    }

    @AuraEnabled
    public static void updateApprovalStatus(Id oppId, String status) {
        Opportunity opp = new Opportunity(
            Id = oppId,
            Approval_Status__c = status
        );
        update opp;
    }
}