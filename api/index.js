const express = require('express')
const cors = require('cors')
const multer = require('multer')

const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const mongoose = require("mongoose");
const User = require("./models/user")
const fs = require("fs")

require('dotenv').config()

const bcrypt = require('bcryptjs')
const PostModel = require('./models/Post')
const salt = bcrypt.genSaltSync(10)
const secret = 'sdefrgbnhgyjmhku2345'

const Post = require("./models/Post.js")

const uploadMiddleware = multer({dest:'uploads/'})

// app.use(express.static(__dirname));
const app = express()

app.use(cors({credentials:true, origin:'http://localhost:3000'}))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(process.env.CONNECTION_URL)

app.post('/register', async (req,res)=>{
    const {username,password} = req.body

    try {
        const userDoc = await User.create(
                {
                    username,
                    password: bcrypt.hashSync(password,salt),
                })
        res.json(userDoc)
    } catch (error) {
        console.log(error)
        res.status(400).json(error)
    }
})

app.post('/login', async (req,res)=>{
    const {username,password}= req.body
    const userDoc = await User.findOne({username})
    // res.json(userDoc)

    const passOk = bcrypt.compareSync(password, userDoc.password)

    if (passOk) {
        // logged in
        jwt.sign({username,id:userDoc._id}, secret, {}, (error,token)=>{
            if(error) throw error
            // res.json(token)
            res.cookie('token', token).json({
                id:userDoc._id,
                username,
            })
        })
    } else {
        res.status(400).json('wrong credentials')
    }
})

app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
    const {originalname,path} = req.file
    const parts = originalname.split('.')
    const ext = parts[parts.length -1]
    const newPath = path+'.'+ext

    fs.renameSync(path, newPath)

    const {token} = req.cookies

    jwt.verify(token, secret, {}, async (err,info)=>{
        if(err) throw err
        // res.json(info)

        const {title,summary,content} = req.body
    
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover:newPath,
            author:info.id,
        })
        res.json(postDoc)
    })
});

app.get('/profile',(req,res)=>{
    // res.json(req.cookies)
    const {token} = req.cookies
    jwt.verify(token, secret, {}, (err,info)=>{
        if(err) throw err
        res.json(info)
    })
    // res.json()
})

app.post('/logout', (req,res) => {
    res.cookie('token', '').json('ok');
})

const port = process.env.PORT 
app.listen(port, ()=>{
    console.log(`listening on ${port}`)
    console.log(`created by PRIYANSHU GUPTA`)
})

app.get('/post',async (req,res)=>{
    // const posts = await Post.find()
    res.json(
        await Post.find()
        .populate('author', ['username'])
        .sort({createdAt:-1})
        .limit(20)
    )
})

app.get('/post/:id', async (req, res) => {
    const {id} = req.params
    const postDoc = await Post.findById(id).populate('author', ['username'])
    
    res.json(postDoc)
})

app.put('/post', uploadMiddleware.single('file'), async (req,res)=>{
    let newPath = null
    if(req.file) {
        const {originalname,path} = req.file
        const parts = originalname.split('.')
        const ext = parts[parts.length -1]
        newPath = path+'.'+ext
        fs.renameSync(path, newPath)
    }

    const {token} = req.cookies

    jwt.verify(token, secret, {}, async (err,info)=>{
        if(err) throw err

        const {id,title,summary,content} = req.body

        const postDoc = await Post.findById(id)

        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id)

        if(!isAuthor){
            return res.status(400).json("you are not the author of this post")
        }
        await postDoc.updateOne({
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });
        res.json(postDoc)
    })
})