
import dotenv from "dotenv";
import app from "./app.js";
dotenv.config({
  path:'./.env'
})


app.listen(process.env.port || 8000,()=> {
    console.log(`Server in running at port:${process.env.port}`);
  })

