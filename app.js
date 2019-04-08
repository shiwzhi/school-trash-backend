var mongoUtil = require('./mongoUtil');
var cookieParser = require('cookie-parser')
const express = require('express')
var bodyParser = require('body-parser')

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

    app.post("/uploaddata", (req, res) => {
        
        var reg = req.body
        reg.regTime = Math.floor(Date.now() / 1000).toString()

        db.collection('device').updateOne({ deviceid: req.body.deviceid },
            {
                $push: { "sensor_data": req.body.sensor_data },
                $set: { 'latestData': req.body.sensor_data, 'latestRegTime': reg.regTime },
                $addToSet: { "regTime": reg.regTime },
            },
            { upsert: true }).then((result) => {
                console.log(result.result)
                res.send("uploaded")
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



    // check if device regtime within sleep time 

    function intervalFunc() {
        db.collection('device').find({}).toArray().then((result) => {
            result.map((device) => {
                try {
                    var lapse = Math.floor(Date.now() / 1000) - parseInt(device.latestRegTime)
                    if (lapse < 3600 * 3.5) {
                        db.collection('device').updateOne({ deviceid: device.deviceid }, { $set: { "devicestatus": "正常" } }, { upsert: true })
                    } else {
                        db.collection('device').updateOne({ deviceid: device.deviceid }, { $set: { "devicestatus": "离线" } }, { upsert: true })
                    }
                } catch (error) {
                    console.log("update status error")
                }
            })
        })
    }

    setInterval(intervalFunc, 10000);

});

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))