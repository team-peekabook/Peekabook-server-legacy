// src/index.ts
import config from "./config";
import express, { NextFunction, Request, Response } from "express";
import router from "./router";

const app = express(); // express 객체 받아옴
const PORT = config.port;

app.use(express.json()); // express 에서 request body를 json 으로 받아오겠다.

app.use("/", router); // use -> 모든 요청

//* HTTP method - GET
app.get("/", (req: Request, res: Response, next: NextFunction) => {
  res.send("Peekabook Server!");
});

app.listen(PORT, () => {
  console.log(`
        #############################################
            🛡️ Server listening on port: ${PORT} 🛡️
        #############################################
    `);
});

export default app;
