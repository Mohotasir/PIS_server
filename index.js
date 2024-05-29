const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://product-information-syst-ea434.firebaseapp.com",
      "https://product-information-syst-ea434.web.app",
    ],
    credentials: true,
  })
);

//--------------------------mongodb-----------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ey9o5hx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const logger = async (req, res, next) => {
  console.log("called:", req.method, req.url);
  next();
};
const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  console.log("token ", token);
  if (!token) {
    return res.status(401).send({ message: "not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized" });
    }
    console.log("value in the token:", decoded);
    req.user = decoded;
    next();
  });
};
const cookieOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};
async function run() {
  try {
    //await client.connect();

    const queryCollection = client.db("pisDB").collection("posts");
    const recomendationCollection = client.db("pisDB").collection("recom");
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.cookie("token", token, cookieOption).send({ success: true });
    });
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOption, maxAge: 0 })
        .send({ success: true });
    });
    app.get("/posts", async (req, res) => {
      const cursor = queryCollection.find().sort({ datePosted: -1 });
      const result = await cursor.toArray();
      res.json(result);
    });
    app.get("/recoms", async (req, res) => {
      const cursor = recomendationCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/recoms", async (req, res) => {
      const email = req.query.email;
      const query = email ? { email: email } : {};
      const cursor = recomendationCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/posts", async (req, res) => {
      const email = req.query.email;
      const query = email ? { email: email } : {};
      const cursor = queryCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // app.get('/posts/:id',async(req,res)=>{
    //   const id = req.params.id;
    //   console.log(id);
    //   const query = {_id : new ObjectId(id)};
    //   const post = await queryCollection.findOne(query);
    //   res.send(post);
    // })
    app.get("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const post = await queryCollection.findOne(query);
      if (post) {
        res.json(post);
      } else {
        res.status(404).json({ error: "Post not found" });
      }
    });
    app.post("/posts", async (req, res) => {
      const post = req.body;
      const result = await queryCollection.insertOne(post);
      res.send(result);
    });
    app.post("/recoms", async (req, res) => {
      try {
        // Extract recommendation data from request body
        const recom = req.body;
        const queryId = recom.queryId;
        console.log(queryId);

        // Increment recommendationCount field in the query document in the queryCollection
        const updateQuery1 = { $inc: { recommendationCount: 1 } };
        await queryCollection.updateOne({ _id: queryId }, updateQuery1);
        // Insert recommendation into the recommendation collection
        const result = await recomendationCollection.insertOne(recom);

        // Send response
        res.status(200).json(result);
      } catch (error) {
        // Handle errors
        console.error("Error adding recommendation:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    app.put("/posts/:id", async (req, res) => {
      const id = req.params.id;
      const spot = req.body;
      console.log(id, spot);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateData = {
        $set: {
          productName: spot.productName,
          productBrand: spot.productBrand,
          productImageUrl: spot.productImageUrl,
          queryTitle: spot.queryTitle,
          boycottingReasonDetails: spot.boycottingReasonDetails,
        },
      };

      const result = await queryCollection.updateOne(
        filter,
        updateData,
        options
      );
      res.send(result);
    });
    app.delete("/posts/:id", async (req, res) => {
      const id = req.params.id;
      console.log("deleted id is:", id);
      const query = { _id: new ObjectId(id) };
      const result = await queryCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/recoms/:id", async (req, res) => {
      const id = req.params.id;
      console.log("deleted id is:", id);
      const query = { _id: new ObjectId(id) };
      const result = await recomendationCollection.deleteOne(query);
      res.send(result);
    });

    //await client.db("admin").command({ ping: 1 });
    //console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

//----------------------end----------------------

app.get("/", (req, res) => {
  res.send("running server");
});

app.listen(port, () => {
  console.log(`app listening on port  ${port}`);
});
