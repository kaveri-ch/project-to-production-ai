trigger AccountTrigger on Account (before insert, before update) {
    if(TriggerControl.isTriggerActive('AccountTrigger')) {
        AccountTriggerHandler.handle(Trigger.new, Trigger.oldMap);
    }
}