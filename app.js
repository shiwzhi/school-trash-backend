var mongoUtil = require('./mongoUtil');
var cookieParser = require('cookie-parser')
const express = require('express')
var bodyParser = require('body-parser')

var mqtt = require('mqtt')
var mqclient = mqtt.connect('mqtts://b.swz1994.com:8883', {
    username: 'shiweizhi',
    password: 'shiwzhi',
    clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
    clean: false,

    rejectUnauthorized: false
})

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

    mqclient.subscribe('/lpssy/trashcan/#', { qos: 2 }, () => { console.log("[MQTT] subscribe success") })

    mqclient.on('message', (topic, msg) => {
        var currentTime = Math.floor(Date.now() / 1000)
        if (topic === '/lpssy/trashcan/esp12/reg') {
            console.log('[MQTT] Device reg id: ' + msg)
            db.collection('device').updateOne({ deviceid: msg.toString() },
                {
                    $set: {
                        "regTime": currentTime
                    }
                }, { upsert: true }).then(result => {
                    console.log("[Mongo] reg update")
                    console.log(result.result)
                })
        }
        if (topic === '/lpssy/trashcan/esp12/upload') {
            console.log('[MQTT] data upload')
            var data = JSON.parse(msg.toString())
            data.time = currentTime
            db.collection('device').updateOne({ deviceid: data.deviceid },
                {
                    $push: { "trash_data": data },
                }, { upsert: true }).then(result => {
                    console.log("[Mongo] data upload")
                    console.log(result.result)
                })
        }
    })

    function refreshStatus() {
        db.collection('device').find({}).toArray().then((result) => {
            result.map((device) => {
                try {
                    var lapse = Math.floor(Date.now() / 1000) - parseFloat(device.regTime)
                    var status = {
                        
                    }
                    if (lapse < (3600 * 3.5)) {
                        status.onlineStatus = '正常'
                        
                    } else {
                        status.onlineStatus = '离线'
                    }

                    db.collection('device').updateOne({ deviceid: device.deviceid }, { $set: { "devicestatus": status.onlineStatus } }, { upsert: true })
                } catch (error) {
                    console.log("update status error")
                }
            })
        })
    }
    setInterval(refreshStatus, 5000);

    app.post("/regdevice", (req, res) => {
        var reg = req.body
        reg.regTime = Math.floor(Date.now() / 1000).toString()
        db.collection('device').updateOne({ deviceid: reg.deviceid }, { $addToSet: { "regTime": reg.regTime, "devicetime": reg.devicetime }, $set: { 'latestRegTime': reg.regTime } }, { upsert: true }).then((result) => {
            console.log(result.result)
        })
        var deviceid = req.body.deviceid
        db.collection('device').find({ deviceid: deviceid }).toArray().then((result) => {
            try {
                res.send(result[0].devicecode)
            } catch (error) {
                console.log("can't get device code")
                res.send("print('cant get device code')")
            }
        })
    })




    app.get('/devices', checkJWT, (req, res) => {
        if (req.query.searchText !== undefined) {
            var db = mongoUtil.getDb()
            db.collection('device').find({ 'deviceinfo': { $regex: ".*" + req.query.searchText + ".*" } }).toArray().then((result) => {
                res.json(result)
            })
            return
        }
        var db = mongoUtil.getDb()
        db.collection('device').find({}).toArray().then((result) => {
            res.json(result)
        })
    })

    app.get('/device', (req, res) => {
        var db = mongoUtil.getDb()
        var deviceid = req.query.deviceid
        db.collection('device').find({ deviceid: deviceid }).toArray().then((result) => {
            res.json(result[0])
        })
    })

    app.post('/updatedevice', (req, res) => {
        console.log("/updatedevice")
        var db = mongoUtil.getDb()
        var device = req.body.device
        console.log(device)

        db.collection('device').updateOne({ deviceid: device.deviceid }, {
            $set: {
                deviceinfo: device.deviceinfo,
                cal_empty: device.cal_empty,
                cal_full: device.cal_full,
            }
        }, { upsert: true }).then((result) => {
            res.json(result)
        })
    })

    app.post('/deldevice', (req, res) => {
        var db = mongoUtil.getDb()
        var device = req.body.device
        db.collection('device').deleteOne({ deviceid: device.deviceid }, (err, obj) => {
            if (err) throw err;
            console.log("1 document deleted");
            res.json(obj)
        })
    })

    app.post('/login', (req, res) => {
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


        // res.json(req.body.username)
    })

    app.post('/logout', (req, res) => {
        try {
            res.cookie('token', "", { httpOnly: true })
            res.json("logout")
        } catch (error) {
            console.log(error)
        }
    })

    app.get('/otacode', (req, res) => {
        var db = mongoUtil.getDb()
        try {
            var time = Math.floor(Date.now() / 1000).toString()
            var deviceid = req.query.deviceid
            var filepath = 'devices/' + deviceid + '/ota.lua'
            if (fs.existsSync(filepath)) {

                db.collection('device').updateOne({ deviceid: deviceid },
                    {
                        $set: {
                            "lastOnlineTime": time,
                            "otaStatus": "Normal"
                        }
                    },
                    { upsert: true })

                res.sendFile('devices/' + deviceid + '/ota.lua', { root: __dirname })
            } else {
                throw error
            }
        } catch (error) {
            console.log("catch error")
            db.collection('device').updateOne({ deviceid: deviceid },
                {
                    $set: {
                        "lastOnlineTime": time,
                        "otaStatus": "can't get ota file",
                        "devicestatus": "设备未配置OTA代码"
                    }
                },
                { upsert: true })
            res.sendFile('devices/generic/ota.lua', { root: __dirname })
        }

    })


    app.post("/uploaddata", (req, res) => {
        var data = req.body
        var time = Math.floor(Date.now() / 1000).toString()
        data.sensor_data.time = time
        db.collection('device').updateOne({ deviceid: data.deviceid },
            {
                $push: { "sensor_data": data.sensor_data },
                $set: {
                    "lastData": data.sensor_data
                }
            },
            { upsert: true }).then((result) => {
                console.log(result.result)
                res.send("uploaded")
                refreshStatus()
            })
    })

});

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

var fs = require('fs');
var https = require('https');
var privateKey = fs.readFileSync('tls/key.pem', 'utf8');
var certificate = fs.readFileSync('tls/cert.pem', 'utf8');
var ca = fs.readFileSync('ca-tls/ca.crt', 'utf8');
var credentials = { key: privateKey, cert: certificate };
var httpsServer = https.createServer(credentials, app);

httpsServer.listen(3131, () => {
    console.log('https listen on 3131')
});