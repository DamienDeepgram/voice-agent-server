This is a production scale node js server that proxies Twilio bi-directional audio streams to the Deepgram Voice Agent API Websocket and pipes the response back to the Twilio client.

The project runs inside docker containers and is deployed to AWS EKS.

The system is designed to be scalable and can handle thousands of concurrent connections.

The project is built with Typescript and Node.js and uses the Express framework for the server and the Twilio SDK for the Twilio API. 

The Deepgram Voice Agent API takes the audio stream and responds with the response audio stream.

Deepgram Voice Agent API Docs: https://developers.deepgram.com/docs/voice-agent API Docs: https://developers.deepgram.com/reference/build-a-voice-agent 

Twilio Node SDK Totorial: https://www.twilio.com/docs/voice/tutorials/how-to-respond-to-incoming-phone-calls/node
