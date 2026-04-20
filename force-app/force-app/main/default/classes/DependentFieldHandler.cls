public with sharing class DependentFieldHandler {
    
    public static void updateDependentFields(List<Account> records) {
        for(Account acc : records) {
            if(acc.Industry == 'IT') {
                acc.Rating = 'Hot';
            } else if(acc.Industry == 'Finance') {
                acc.Rating = 'Warm';
            }
        }
    }
}