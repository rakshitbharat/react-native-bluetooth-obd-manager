#codebase 

we have function called sendCommand
now we have to check that it give us reponse but
sendCommand internally use write ot write withouth reponse method of react native ble manager

here the logic is we collect responses from 
BleManagerDidUpdateValueForCharacteristic

now we have a situation like

if we send a AT command its not like 
the response will be in a single data at 
BleManagerDidUpdateValueForCharacteristic
it can be infinte and non predirected until we get a response terminater 
let me explain another way

if we send AT Command we can get async response
response-byte-1
response-byte-2
response-byte-n 
until we get response-byte-n-end with terminator 

are we collecting all of this and at last we are returning it back at sendCommand ?


now we are in a trouble i think this reponse should not be like
[69, 76, 77, 51, 50, 55, 32, 118, 49, 46, 53, 62]

instead
[[69, 76, 77], [51, 50, 55], [32, 118, 49, 46, 53, 62]]

this means when we use sendCommand we get in return string that will work like this 
[69, 76, 77, 51, 50, 55, 32, 118, 49, 46, 53, 62]
can be easily able to become string but it will loose \n new like that is also important 
and on next function
when we use 
sendCommandRaw
we should get
[[69, 76, 77], [51, 50, 55], [32, 118, 49, 46, 53, 62]]