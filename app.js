var mongoUtil = require('./mongoUtil');
var cookieParser = require('cookie-parser')
const express = require('express')
var bodyParser = require('body-parser')
var multer = require('multer')
var upload = multer({ dest: 'uploads/' })

const bcrypt = require('bcrypt');
const saltRounds = 10;

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
        console.log(req.headers)
        var chipid = req.headers['esp-chipid']
        var data = req.headers['hcsr-04']

        var time = Math.floor(Date.now() / 1000).toString()
        try {
            db.collection('device').updateOne({ deviceid: chipid },
                {
                    $push: {
                        "trash_data": { data: data, time: time }
                    }
                },
                { upsert: true }).then(result => {
                    db.collection('device').findOne({ deviceid: chipid }, (err, result) => {
                        var sleep_time = result.sleep_h
                        if (sleep_time !== undefined) {
                            res.send("SLEEP" + sleep_time);
                        }
                        else {
                            res.send("SLEEP180")
                        }
                    })
                })
        } catch (error) {
            console.log(error)
        }
    })


    app.get('/api/device/all', (req, res) => {
        db.collection('device').find({}).toArray().then((result) => {
            res.json(result)
        })
    })

    app.get('/api/device/info', checkJWT, (req, res) => {
        console.log("check user info")
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
            if (result.result.ok === 1) {
                res.send("设备信息更新成功")
            } else {
                res.send("设备信息更新失败")
            }
        })
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
        var user = req.body.username
        var pass = req.body.password

        db.collection('users').findOne({ username: user }, (err, result) => {
            if (result !== null) {
                bcrypt.compare(pass, result.password, function (err, result) {
                    if (result) {
                        console.log("bcrypt correct")
                        var token = jwt.sign({ username: user }, token_secret);
                        loggedUser[user] = token
                        res.cookie('token', token, { httpOnly: true })
                        res.send("登录成功")
                    } else {
                        res.status(401)
                        res.send("cridet incorrect")
                    }
                });
            } else {
                res.status(401)
                res.send("用户名或密码错误")
            }
        })
    })

    app.post('/api/user/logout', (req, res) => {
        try {
            res.cookie('token', "", { httpOnly: true })
            res.json("logout")
        } catch (error) {
            console.log(error)
        }
    })

    app.post('/api/user/update', (req, res) => {
        var user = req.body.username
        var pass = req.body.password
        bcrypt.hash(pass, saltRounds, function (err, hash) {
            db.collection('users').updateOne({ username: user },
                {
                    $set: {
                        password: hash
                    }
                }).then(result => {
                    console.log(result)
                    if (result.result.ok === 1) {
                        res.send("用户信息更新成功")
                    } else {
                        res.send("用户信息更新失败")
                    }
                })
        });


    })

    app.post('/api/user/add', (req, res) => {
        var user = req.body.username
        var pass = req.body.password
        var time = Math.floor(Date.now() / 1000).toString()
        try {
            db.collection('users').findOne({ username: user }, (err, result) => {
                if (err) {
                    res.status(500).send("error")
                }
                if (result !== null) {
                    res.json({
                        status: "error",
                        msg: "用户存在"
                    })
                } else {
                    bcrypt.hash(pass, saltRounds, function (err, hash) {
                        db.collection('users').insertOne({
                            username: user,
                            password: hash,
                            regTime: time
                        }, (err, result) => {
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
                    });

                }
            })
        } catch (error) {
        }
    })

    app.post('/api/user/del', (req, res) => {
        var user = req.body.username
        db.collection('users').deleteOne({ username: user }, (err, obj) => {
            if (err) throw err;
            console.log("1 document deleted");
            res.json(obj)
        })
    })

    app.get('/api/user/all', (req, res) => {
        try {
            db.collection('users').find({}, (err, result) => {
                if (err) {
                    res.status(500)
                }
                result.toArray().then((array) => {
                    res.json(array)
                })

            })
        } catch (error) {
            console.log(error)
        }
    })

    app.post('/api/user/info', checkJWT, (req, res) => {
        console.log("userinfo")
        var token = req.cookies.token
        var decoded = jwt.verify(token, token_secret)

        var username = decoded.username
        db.collection('users').findOne({ username }, (err, result) => {
            if (err) {
                res.status(500)
            }
            console.log(result)
            res.json(result)
        })
    })

    app.get('/api/user/devices', checkJWT, (req, res) => {
        var token = req.cookies.token
        var decoded = jwt.verify(token, token_secret)
        var username = decoded.username

        db.collection('users').findOne({ username }, (err, result) => {
            if (err) {
                res.status(500)
            }
            var devices = result.devices
            console.log(devices)
            var detail_devices = []
            devices.forEach(async (device)=>{
                 var device = await db.collection('device').findOne({deviceid: device})
                 detail_devices.push(device)
            })
            console.log(detail_devices)

            res.send('.')
        })

    })


    app.post('/api/user/save_device', checkJWT, (req, res) => {
        var token = req.cookies.token
        var decoded = jwt.verify(token, token_secret)
        var username = decoded.username
        if (req.body.action === 'star') {
            db.collection('users').updateOne({ username: username }, {
                $addToSet: {
                    devices: req.body.deviceId
                }
            })
            res.send(".")
        }
        if (req.body.action === 'unstar') {
            db.collection('users').updateOne({ username: username }, {
                $pull: {
                    devices: req.body.deviceId
                }
            })
            res.send("..")
        }
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