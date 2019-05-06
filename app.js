var mongoUtil = require('./mongoUtil');
var cookieParser = require('cookie-parser')
const express = require('express')
var bodyParser = require('body-parser')
var multer = require('multer')
var upload = multer({ dest: 'uploads/' })

const app = express()
app.use(bodyParser.json())
app.use(cookieParser())
const port = 3100

const token_secret = "i'm shiweizhi"

var cors = require('cors')
app.use(cors({
    credentials: true,
    origin: ['http://localhost:3000']
}))

var jwt = require('jsonwebtoken');

const loggedUser = {
}

function checkJWT(req, res, next) {
    try {
        var token = req.cookies.token
        var decoded = jwt.verify(token, token_secret)
        if (loggedUser[decoded.username] !== token) {
            throw "token not equal"
        }
        next()
    } catch (error) {
        console.log(error)
        res.status(401)
        res.send("..")
        return
    }
}


mongoUtil.connectToServer(function (err) {

    var db = mongoUtil.getDb()

    app.post("/upload", (req, res) => {
        console.log(req.body);
        try {
            var upload = req.body
            var time = Math.floor(Date.now() / 1000).toString()
            upload.time = time

            db.collection('device').updateOne({ deviceid: upload.deviceid },
                {
                    $push: {
                        "trash_data": { data: upload.data, time: upload.time }
                    }
                },
                { upsert: true }).then(result => {
                    db.collection('device').findOne({ deviceid: upload.deviceid }, (err, result) => {
                        if (result.sleep_h !== undefined && result.ota !== undefined) {
                            res.json({
                                sleep_h: result.sleep_h,
                                ota: result.ota
                            })
                        } else {
                            res.json({
                                sleep_h: String(1.5),
                                ota: false
                            })
                        }
                    })
                })
        } catch (error) {
            console.log(error)
        }
    })

    app.get("/ota", (req, res) => {
        try {
            var deviceid = req.headers["x-esp8266-version"]
            db.collection('device').findOne({ deviceid: deviceid }, (err, result) => {
                var file = result.otafile
                res.sendFile(file, { root: __dirname })

                db.collection('device').updateOne({ deviceid: deviceid },
                    {
                        $set: {
                            ota: false
                        }
                    })

            })
        } catch (error) {
            console.log(error)
            res.status(304).send("noupdate")
        }

    })

    app.get('/api/device/all', (req, res) => {
        db.collection('device').find({}).toArray().then((result) => {
            res.json(result)
        })
    })

    app.get('/api/device/info', (req, res) => {
        var db = mongoUtil.getDb()
        var deviceid = req.query.deviceid
        db.collection('device').find({ deviceid: deviceid }).toArray().then((result) => {
            res.json(result[0])
        })
    })

    app.post('/api/device/update', (req, res) => {
        console.log("/updatedevice")
        var device = req.body.device

        db.collection('device').updateOne({ deviceid: device.deviceid }, {
            $set: {
                deviceinfo: device.deviceinfo,
                cal_empty: device.cal_empty,
                cal_full: device.cal_full,
                sleep_h: device.sleep_h,
                ota: device.ota
            }
        }, { upsert: true }).then((result) => {
            res.json(result)
        })
    })

    app.post("/api/device/uploadOTAfile", upload.single("file"), (req, res) => {

        try {
            db.collection('device').updateOne({ deviceid: req.body.deviceid }, {
                $set: {
                    otafile: req.file.path
                }
            }, { upsert: true }).then((result) => {
            })
        } catch (error) {

        }


        res.send("ok")
    })

    app.post('/api/device/delete', (req, res) => {
        var device = req.body.device
        db.collection('device').deleteOne({ deviceid: device.deviceid }, (err, obj) => {
            if (err) throw err;
            console.log("1 document deleted");
            res.json(obj)
        })
    })

    app.post('/api/user/login', (req, res) => {
        if (req.body.username === "shiweizhi") {
            var token = jwt.sign({ username: 'shiweizhi' }, token_secret);
            loggedUser[req.body.username] = token
            console.log(loggedUser)
            res.cookie('token', token, { httpOnly: true })
            res.json(req.body.username)
        }
        else {
            res.status(401)
            res.send("..")
        }
    })

    app.post('/api/user/logout', (req, res) => {
        try {
            res.cookie('token', "", { httpOnly: true })
            res.json("logout")
        } catch (error) {
            console.log(error)
        }
    })

    app.post('/api/user/add', (req, res) => {
        console.log(req.body)
        var user = req.body.username
        var pass = req.body.password
        var time = Math.floor(Date.now() / 1000).toString()
        try {
            db.collection('users').findOne({username: user}, (err, result) => {
                if (err) {
                    res.status(500).send("error")
                }
                if (result !== null) {
                    res.json({
                        status: "error",
                        msg: "用户存在"
                    })
                } else {
                    db.collection('users').insertOne({
                        username: user,
                        password: pass,
                        regTime: time
                    }, (err, result)=>{
                        if (err) {
                            res.status(500).send("error")
                        }
                      if (result.result.ok) {
                          res.json({
                              status: "success",
                              msg: "添加用户成功"
                          })
                      } else {
                          res.json({
                              status: "error",
                              msg: "添加用户失败"
                          })
                      }
                    })
                }
            })
        } catch (error) {
        }
    })

    app.post('/api/user/del', (req, res)=> {
        var user = req.body.username
        db.collection('users').deleteOne({ username: user }, (err, obj) => {
            if (err) throw err;
            console.log("1 document deleted");
            res.json(obj)
        })
    })

    app.get('/api/user/all', (req, res)=>{
        try {
            db.collection('users').find({}, (err, result)=>{
                if (err) {
                    res.status(500)
                }
                result.toArray().then((array)=> {
                    console.log(array)
                    res.json(array)
                })
                
            })
        } catch (error) {
            console.log(error)
        }
    })

    app.post('/api/user/info', (req, res)=>{
        var username = req.body.user
        db.collection('users').findOne({username}, (err, result)=>{
            if (err) {
                res.status(500)
            }
            res.json(result)
        })
    })

});

app.get('/', (req, res) => res.send('Hello World!'))


app.listen(port, () => console.log(`Example app listening on port ${port}!`))

var fs = require('fs');
var https = require('https');
var privateKey = fs.readFileSync('tls/key.pem', 'utf8');
var certificate = fs.readFileSync('tls/cert.pem', 'utf8');
var credentials = { key: privateKey, cert: certificate };
var httpsServer = https.createServer(credentials, app);

httpsServer.listen(3131, () => {
    console.log('https listen on 3131')
});