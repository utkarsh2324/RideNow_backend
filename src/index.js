import connectDB from "./db/index.js";
import dotenv from "dotenv";
import app from "./app.js";
dotenv.config({
  path:'./.env'
})
connectDB()
.then(()=>{
  app.listen(process.env.port || 8000,()=> {
    console.log(`Server in running at port:${process.env.port}`);
  })
})
.catch((err)=>{
  console.log("MongoDB connection failed ",err);
})