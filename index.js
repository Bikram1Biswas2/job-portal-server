const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser');
const app = express()
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');



// middleware
app.use(cors({
    origin:['http://localhost:5173'],
    credentials:true
}))
app.use(express.json())
app.use(cookieParser())

const verifyToken = (req,res,next)=>{
    const token = req?.cookies?.token 

    if(!token){
        return res.status(401).send({message: 'Unauthorized access'})
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
            return res.status(401).send({message:'Unauthorized access'})
        }
        req.user = decoded;
        next()
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.znhzfas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const jobsCollection = client.db('job_portal').collection('jobs')
    const jobApplicationCollection = client.db('job_portal').collection('job_applications')

    // remove the token when logout
    app.post('/logout',async(req,res)=>{
      res.clearCookie('token',{
        httpOnly:true,
        secure:false
      })
      .send({success: true})
    })

    // Auth Related apis
    app.post('/jwt',async(req,res)=>{
      const user = req.body 
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn: '1h'})
      res
      .cookie('token',token,{
        httpOnly: true,
        secure: false,
      })
      .send({success: true})
    })

    // get all jobs
    app.get('/jobs',async(req,res)=>{
     const email = req.params.email 
        let query = {} 
        if(email){
            query= {hr_email: email}
        }
        const cursor = jobsCollection.find(query)
        const result = await cursor.toArray()
        res.send(result)
    })

    // Specific job details
    app.get('/jobs/:id',async(req,res)=>{
        const id = req.params.id 
        const query = {_id:new ObjectId(id)}
        const result = await jobsCollection.findOne(query)
        res.send(result)
    })

    // add new job
    app.post('/jobs',async(req,res)=>{
        const newJob = req.body 
        const result = await jobsCollection.insertOne(newJob)
        res.send(result)
    })

    // job application apis 

    // get job apply data by email
    app.get('/job-applications',verifyToken, async(req,res)=>{
        const email = req.query.email 
        const query = {applicant_email:email}

       if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'forbidden access'})
       }

        const result = await jobApplicationCollection.find(query).toArray()

        // not the best way
        for(const application of result){
            //console.log(application.job_id);
            const query1 = {_id: new ObjectId(application.job_id)}
            const job = await jobsCollection.findOne(query1)
            if(job){
                application.title=job.title;
                application.company = job.company;
                application.company_logo= job.company_logo
                application.location = job.location
                application.category = job.category
            }
        }

        res.send(result)
    })

    // for job applications
    app.get('/job-applications/jobs/:job_id',async(req,res)=>{
        const jobId = req.params.job_id 
        const query = {job_id: jobId}
        const result = await jobApplicationCollection.find(query).toArray()
        res.send(result)
    })

    // post job
    app.post('/job-applications',async(req,res)=>{
        const application = req.body 
        const result= await jobApplicationCollection.insertOne(application)

        // not the best way(use aggregate)
        const id = application.job_id 
        const query = {_id: new ObjectId(id)}
        const job = await jobsCollection.findOne(query)
        let newCount = 0 
        if(job.applicationCount){
          newCount = job.applicationCount+1
        }else{
            newCount = 1
        }

        // update the job info 
        const filter = {_id: new ObjectId(id)}
        const updatedDoc = {
            $set: {
                applicationCount: newCount
            }
        }
        const updateResult = await jobsCollection.updateOne(filter,updatedDoc)

        res.send(result)
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
 res.send('job is falling from the sky')
})

app.listen(port, ()=>{
    console.log(`job is waiting on port ${port}`);
})