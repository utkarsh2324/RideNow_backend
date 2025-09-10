import express from "express";
import cors from "cors";



const app=express()
app.use(
    cors({
      origin: "*",
      credentials: true,
    })
  );

app.get("/", (req, res) => {
    res.send("✅ Server is running fine!");
  });
app.use(express.json({limit:"500mb"}))
app.use(express.urlencoded({
    extended:true,limit:"500mb"
}))
export default app;