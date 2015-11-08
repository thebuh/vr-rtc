This is early prototype with a log of bugs to work out. But its somewhat works.


# How to start

You need https certs for this demo to function (due to Chrome restrictions of getUserMedia to HTTPS only)

Put them in /certs dir. Modify server.js accordingly.

Run 

``
node server.js
``

Server listens  at https://<ip>:8080

You have to start casting from 2 sources before visiting VR page for demo to work (for now).